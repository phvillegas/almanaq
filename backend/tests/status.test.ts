import { describe, expect, it } from 'vitest';

import { hayCobertura, proximosFeriados } from '../src/domain/holidays.js';
import {
  resolverConflictoDelDia,
  resolverDetalle,
  resolverEstado,
} from '../src/domain/status.js';

const ISRAEL = { countryCode: 'IL', timezone: 'Asia/Jerusalem' };
const ETIOPIA = { countryCode: 'ET', timezone: 'Africa/Addis_Ababa' };
const NEPAL = { countryCode: 'NP', timezone: 'Asia/Kathmandu' };
const ARGENTINA = { countryCode: 'AR', timezone: 'America/Argentina/Buenos_Aires' };
const BUTAN = { countryCode: 'BT', timezone: 'Asia/Thimphu' };

describe('Israel — fin de semana viernes y sábado', () => {
  it('marca el viernes como fin de semana local', () => {
    // Viernes 21/8/2026, 18:42 en Tel Aviv. Es el caso que define el producto:
    // en Buenos Aires es viernes al mediodía y parece un día normal.
    const estado = resolverEstado(ISRAEL, new Date('2026-08-21T15:42:00Z'));

    expect(estado.status).toBe('LOCAL_WEEKEND');
    expect(estado.statusLabel).toBe('Fin de semana');
    expect(estado.statusDetail).toBe('Fin de semana en Israel');
    expect(estado.localTime).toBe('18:42');
    expect(estado.utcOffsetMinutes).toBe(180);
  });

  it('el domingo es día laboral, no fin de semana', () => {
    const estado = resolverEstado(ISRAEL, new Date('2026-08-23T07:00:00Z'));

    expect(estado.localWeekday).toBe('sunday');
    expect(estado.status).not.toBe('LOCAL_WEEKEND');
  });

  it('no afirma disponibilidad sin datos de feriados del país', () => {
    // El proveedor gratuito no cubre Israel. Un domingo laboral a las 10 de la mañana
    // igual da UNKNOWN, porque podría ser feriado y no tenemos cómo saberlo.
    // PLAN.md sección 10, regla 3.
    expect(hayCobertura('IL', '2026-08-23')).toBe(false);

    const estado = resolverEstado(ISRAEL, new Date('2026-08-23T07:00:00Z'));

    expect(estado.status).toBe('UNKNOWN');
    expect(estado.statusDetail).toBe('Sin datos de feriados en Israel');
  });
});

describe('Etiopía — calendario propio y feriado nacional', () => {
  it('marca el feriado con su nombre', () => {
    // 2 de marzo de 2026: Adwa Victory Day, un lunes.
    const estado = resolverEstado(ETIOPIA, new Date('2026-03-02T09:00:00Z'));

    expect(estado.status).toBe('LOCAL_HOLIDAY');
    expect(estado.statusLabel).toBe('Feriado');
    expect(estado.statusDetail).toBe('Feriado en Etiopía: Adwa Victory Day');
    expect(estado.feriado?.date).toBe('2026-03-02');
  });

  it('un día laboral normal en horario da disponible', () => {
    // Martes 3 de marzo, 12:00 en Addis Abeba.
    const estado = resolverEstado(ETIOPIA, new Date('2026-03-03T09:00:00Z'));

    expect(estado.status).toBe('AVAILABLE');
    expect(estado.statusDetail).toBe('En horario hasta las 18:00');
  });

  it('fuera de horario distingue si la jornada no empezó o ya terminó', () => {
    const temprano = resolverEstado(ETIOPIA, new Date('2026-03-03T04:00:00Z'));
    const tarde = resolverEstado(ETIOPIA, new Date('2026-03-03T16:00:00Z'));

    expect(temprano.status).toBe('OFF_HOURS');
    expect(temprano.statusDetail).toBe('Empieza a las 9:00');
    expect(tarde.status).toBe('OFF_HOURS');
    expect(tarde.statusDetail).toBe('Terminó a las 18:00');
  });

  it('el detalle incluye el calendario etíope y los próximos feriados', () => {
    const detalle = resolverDetalle(ETIOPIA, new Date('2026-03-02T09:00:00Z'));

    expect(detalle.localCalendar?.label).toBe('Etíope');
    expect(detalle.localCalendar?.currentYear).toBe('2018');
    expect(detalle.workWeek.daysLabel).toBe('lun a vie');
    expect(detalle.upcomingHolidays.length).toBeGreaterThan(0);
    expect(detalle.upcomingHolidays.length).toBeLessThanOrEqual(3);
    expect(detalle.upcomingHolidays[0]?.startDate).toBe('2026-03-02');
  });
});

describe('Nepal — offset de 5:45 y sábado libre', () => {
  it('resuelve la hora local con offset fraccionario', () => {
    const estado = resolverEstado(NEPAL, new Date('2026-08-21T00:00:00Z'));

    expect(estado.utcOffsetMinutes).toBe(345);
    expect(estado.localTime).toBe('05:45');
  });

  it('el sábado es fin de semana aunque no haya datos de feriados', () => {
    // Sábado 22/8/2026. La tabla de semanas laborales sí cubre Nepal, así que el fin
    // de semana se afirma con confianza incluso sin cobertura de feriados.
    const estado = resolverEstado(NEPAL, new Date('2026-08-22T06:00:00Z'));

    expect(estado.localWeekday).toBe('saturday');
    expect(estado.status).toBe('LOCAL_WEEKEND');
    expect(estado.statusDetail).toBe('Fin de semana en Nepal');
  });

  it('el viernes es laboral en Nepal', () => {
    const estado = resolverEstado(NEPAL, new Date('2026-08-21T06:00:00Z'));

    expect(estado.localWeekday).toBe('friday');
    expect(estado.status).not.toBe('LOCAL_WEEKEND');
  });
});

describe('país sin datos', () => {
  it('devuelve UNKNOWN en vez de asumir lunes a viernes', () => {
    // Bután no está en la tabla de semanas laborales ni en los archivos de feriados.
    const estado = resolverEstado(BUTAN, new Date('2026-08-19T06:00:00Z'));

    expect(estado.status).toBe('UNKNOWN');
    expect(estado.statusLabel).toBe('Sin datos');
    expect(estado.statusDetail).toBe('Sin datos de feriados en Bután');
  });

  it('un override manual alcanza para resolver un país sin tabla', () => {
    const estado = resolverEstado(
      { ...BUTAN, overrides: { workDays: ['monday', 'tuesday', 'wednesday', 'thursday'] } },
      new Date('2026-08-21T06:00:00Z'),
    );

    // Viernes con override: el usuario declaró que no trabaja. Ya no es una suposición
    // nuestra, aunque siga sin haber datos de feriados.
    expect(estado.localWeekday).toBe('friday');
    expect(estado.status).toBe('LOCAL_WEEKEND');
  });

  it('no hay feriados para un país sin archivo', () => {
    expect(proximosFeriados('BT', '2026-01-01')).toEqual([]);
    expect(hayCobertura('BT', '2026-08-19')).toBe(false);
  });

  it('un año fuera de los generados cuenta como sin cobertura', () => {
    // Argentina tiene archivo, pero solo para los años que generó el script.
    expect(hayCobertura('AR', '2026-08-19')).toBe(true);
    expect(hayCobertura('AR', '2040-08-19')).toBe(false);

    const estado = resolverEstado(ARGENTINA, new Date('2040-08-20T13:00:00Z'));
    expect(estado.status).toBe('UNKNOWN');
  });
});

describe('resolverConflictoDelDia', () => {
  it('devuelve null cuando el día está limpio', () => {
    expect(resolverConflictoDelDia(ETIOPIA, '2026-03-03')).toBeNull();
  });

  it('reporta el fin de semana local de Israel', () => {
    expect(resolverConflictoDelDia(ISRAEL, '2026-08-21')).toEqual({
      reason: 'LOCAL_WEEKEND',
      detail: 'Fin de semana en Israel',
    });
  });

  it('reporta el feriado con su nombre', () => {
    expect(resolverConflictoDelDia(ETIOPIA, '2026-03-02')).toEqual({
      reason: 'LOCAL_HOLIDAY',
      detail: 'Feriado en Etiopía: Adwa Victory Day',
    });
  });

  it('no evalúa horario laboral, porque una fecha no tiene hora', () => {
    const conflicto = resolverConflictoDelDia(ARGENTINA, '2026-08-19');

    expect(conflicto).toBeNull();
  });

  it('la fecha se lee como fecha civil, sin correrse por el huso', () => {
    // Con anclaje a medianoche UTC, un huso negativo devolvería el día anterior y
    // el sábado se leería como viernes.
    expect(resolverConflictoDelDia(ARGENTINA, '2026-08-22')?.reason).toBe('LOCAL_WEEKEND');
    expect(resolverConflictoDelDia(ARGENTINA, '2026-08-21')).toBeNull();
  });
});
