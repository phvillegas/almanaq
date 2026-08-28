import { describe, expect, it } from 'vitest';

import {
  esDiaLaboral,
  estaEnHorario,
  etiquetaDias,
  etiquetaFinDeSemana,
  etiquetaHorario,
  obtenerSemanaLaboral,
} from '../src/domain/workweek.js';

describe('obtenerSemanaLaboral', () => {
  it('resuelve la semana de Israel de domingo a jueves', () => {
    const semana = obtenerSemanaLaboral('IL');

    expect(etiquetaDias(semana)).toBe('dom a jue');
    expect(etiquetaFinDeSemana(semana)).toBe('vie y sáb');
    expect(esDiaLaboral(semana, 'friday')).toBe(false);
    expect(esDiaLaboral(semana, 'sunday')).toBe(true);
    expect(semana.inferida).toBe(false);
  });

  it('resuelve Nepal con un solo día de fin de semana', () => {
    const semana = obtenerSemanaLaboral('NP');

    expect(etiquetaDias(semana)).toBe('dom a vie');
    expect(etiquetaFinDeSemana(semana)).toBe('sáb');
  });

  it('resuelve Irán de sábado a jueves', () => {
    const semana = obtenerSemanaLaboral('IR');

    expect(etiquetaDias(semana)).toBe('sáb a jue');
    expect(etiquetaFinDeSemana(semana)).toBe('vie');
  });

  it('redacta el fin de semana no contiguo de Brunéi', () => {
    const semana = obtenerSemanaLaboral('BN');

    expect(etiquetaDias(semana)).toBe('lun a jue y sáb');
    expect(etiquetaFinDeSemana(semana)).toBe('vie y dom');
  });

  it('une sábado y domingo como un solo tramo aunque estén en las puntas', () => {
    const semana = obtenerSemanaLaboral('AR');

    expect(etiquetaDias(semana)).toBe('lun a vie');
    expect(etiquetaFinDeSemana(semana)).toBe('sáb y dom');
  });

  it('marca como inferida la semana de un país que no está en la tabla', () => {
    expect(obtenerSemanaLaboral('AR').inferida).toBe(true);
    expect(obtenerSemanaLaboral(null).inferida).toBe(true);
  });

  it('aplica el horario por defecto de 9 a 18', () => {
    expect(etiquetaHorario(obtenerSemanaLaboral('IL'))).toBe('9:00 a 18:00');
  });
});

describe('overrides manuales', () => {
  it('el override de días gana sobre la tabla del país', () => {
    const semana = obtenerSemanaLaboral('IL', {
      workDays: ['monday', 'tuesday', 'wednesday'],
    });

    expect(etiquetaDias(semana)).toBe('lun a mié');
    expect(semana.conOverrides).toBe(true);
    // Un override es un dato declarado por el usuario: deja de ser una inferencia.
    expect(semana.inferida).toBe(false);
  });

  it('un override parcial de horario no toca los días del país', () => {
    const semana = obtenerSemanaLaboral('IL', {
      workStartLocal: '08:00',
      workEndLocal: '14:30',
    });

    expect(etiquetaDias(semana)).toBe('dom a jue');
    expect(etiquetaHorario(semana)).toBe('8:00 a 14:30');
  });

  it('ignora horarios con formato inválido en vez de romper', () => {
    const semana = obtenerSemanaLaboral('AR', { workStartLocal: '25:00' });

    expect(etiquetaHorario(semana)).toBe('9:00 a 18:00');
    expect(semana.conOverrides).toBe(false);
  });
});

describe('estaEnHorario', () => {
  const semana = obtenerSemanaLaboral('AR');

  it('incluye el minuto de inicio y excluye el de fin', () => {
    expect(estaEnHorario(semana, '09:00')).toBe(true);
    expect(estaEnHorario(semana, '17:59')).toBe(true);
    expect(estaEnHorario(semana, '18:00')).toBe(false);
    expect(estaEnHorario(semana, '08:59')).toBe(false);
  });

  it('soporta turnos que cruzan la medianoche', () => {
    const nocturno = obtenerSemanaLaboral('AR', {
      workStartLocal: '22:00',
      workEndLocal: '06:00',
    });

    expect(estaEnHorario(nocturno, '23:30')).toBe(true);
    expect(estaEnHorario(nocturno, '02:00')).toBe(true);
    expect(estaEnHorario(nocturno, '12:00')).toBe(false);
  });
});
