import { formatNumber, safeDivide, toNumber } from '../utils.js';

const method6 = {
  id: 'delivery-route-small-shipments',
  name: '6. Развозочный маршрут (мелкие отправки)',
  description:
    'Методика расчёта показателей работы автомобиля на развозочном маршруте при перевозке мелких отправок с несколькими точками разгрузки.',
  inputs: [
    { name: 'payloadCapacity', label: 'Грузоподъёмность автомобиля (q), т', min: 0, step: 0.1, defaultValue: 6 },
    {
      name: 'loadFactor',
      label: 'Коэффициент использования грузоподъёмности (γ)',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 1,
    },
    { name: 'loadUnloadTime', label: 'Время на погрузку-выгрузку (tₚᵥ), ч', min: 0, step: 0.01, defaultValue: 0.4 },
    {
      name: 'detourTime',
      label: 'Время заезда (t_z), ч',
      min: 0,
      step: 0.01,
      defaultValue: 0.15,
    },
    { name: 'loadedDistance1', label: 'Пробег с грузом на 1-м звене (l_g₁), км', min: 0, step: 0.1, defaultValue: 11 },
    { name: 'loadedDistance2', label: 'Пробег с грузом на 2-м звене (l_g₂), км', min: 0, step: 0.1, defaultValue: 8 },
    { name: 'loadedDistance3', label: 'Пробег с грузом на 3-м звене (l_g₃), км', min: 0, step: 0.1, defaultValue: 7 },
    { name: 'emptyDistance', label: 'Холостой пробег (lₓ), км', min: 0, step: 0.1, defaultValue: 3 },
    { name: 'demandB', label: 'Потребность в грузе п. B (q_B), т', min: 0, step: 0.1, defaultValue: 1 },
    { name: 'demandC', label: 'Потребность в грузе п. C (q_C), т', min: 0, step: 0.1, defaultValue: 3 },
    { name: 'demandD', label: 'Потребность в грузе п. D (q_D), т', min: 0, step: 0.1, defaultValue: 2 },
    { name: 'unloadingPoints', label: 'Число пунктов разгрузки (P), шт', min: 1, step: 1, defaultValue: 3 },
    { name: 'technicalSpeed', label: 'Среднетехническая скорость (Vₜ), км/ч', min: 0, step: 0.1, defaultValue: 29 },
  ],
  calculate: (values) => {
    const payloadCapacity = toNumber(values.payloadCapacity);
    const loadFactor = toNumber(values.loadFactor);
    const loadUnloadTime = toNumber(values.loadUnloadTime);
    const detourTime = toNumber(values.detourTime);
    const loadedDistance1 = toNumber(values.loadedDistance1);
    const loadedDistance2 = toNumber(values.loadedDistance2);
    const loadedDistance3 = toNumber(values.loadedDistance3);
    const emptyDistance = toNumber(values.emptyDistance);
    const demandB = toNumber(values.demandB);
    const demandC = toNumber(values.demandC);
    const demandD = toNumber(values.demandD);
    const unloadingPoints = toNumber(values.unloadingPoints);
    const technicalSpeed = toNumber(values.technicalSpeed);

    const totalLoadedAtA = demandB + demandC + demandD;
    const routeLength = loadedDistance1 + loadedDistance2 + loadedDistance3 + emptyDistance;
    const tripTime =
      safeDivide(routeLength, technicalSpeed) + loadUnloadTime + detourTime * Math.max(unloadingPoints - 1, 0);

    const effectiveLoad = payloadCapacity * loadFactor;

    const tonKm =
      totalLoadedAtA * loadedDistance1 +
      Math.max(totalLoadedAtA - demandB, 0) * loadedDistance2 +
      Math.max(totalLoadedAtA - demandB - demandC, 0) * loadedDistance3;

    return {
      'Длина маршрута lₘ = l_g₁ + l_g₂ + l_g₃ + lₓ, км': formatNumber(routeLength),
      'Время ездки (tₑₒ), ч': formatNumber(tripTime),
      'Выработка за ездку Qₑ, т': formatNumber(effectiveLoad),
      'Выработка в тонно-километрах за ездку (Pₑ), т·км': formatNumber(tonKm),
      'Tн факт (фактическое время в наряде), ч': formatNumber(tripTime),
      'Фактическая загрузка из пункта A (q_A = q_B + q_C + q_D), т': formatNumber(totalLoadedAtA),
      'Проверка баланса груза (q_A / q·γ)': formatNumber(safeDivide(totalLoadedAtA, effectiveLoad)),
    };
  },
};

export { method6 };
