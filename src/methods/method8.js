import { formatNumber, safeDivide, toNumber } from '../utils.js';

const method8 = {
  id: 'mixed-delivery-collection-route',
  name: 'Методика расчёта показателей работы автомобиля на развозочно-сборном маршруте',
  description:
    'Расчёт для развозочно-сборного маршрута (рис. 10): длина маршрута, время оборота, выработка за оборот и тонно-километры с учётом доставок и сборов.',
  inputs: [
    { name: 'payloadCapacity', label: 'Грузоподъёмность автомобиля (q), т', min: 0, step: 0.1, defaultValue: 10 },
    { name: 'unloadLoadTime', label: 'Время разгру-погрузки (tₚₚᵥ), ч', min: 0, step: 0.01, defaultValue: 0.8 },
    { name: 'collectionLoadTime', label: 'Время сбор-погрузки (tₛₚᵥ), ч', min: 0, step: 0.01, defaultValue: 0.8 },
    { name: 'detourTime', label: 'Время заезда (t_z), ч', min: 0, step: 0.01, defaultValue: 0.2 },
    { name: 'loadedDistance1', label: 'Пробег с грузом l_g₁, км', min: 0, step: 0.1, defaultValue: 7 },
    { name: 'loadedDistance2', label: 'Пробег с грузом l_g₂, км', min: 0, step: 0.1, defaultValue: 11 },
    { name: 'loadedDistance3', label: 'Пробег с грузом l_g₃, км', min: 0, step: 0.1, defaultValue: 8 },
    { name: 'loadedDistance4', label: 'Пробег с грузом l_g₄, км', min: 0, step: 0.1, defaultValue: 10 },
    { name: 'demandB', label: 'Потребность в доставке в п. B (q_B_need), т', min: 0, step: 0.1, defaultValue: 6 },
    { name: 'pickupB', label: 'Наличие к сбору в п. B (q_B_pick), т', min: 0, step: 0.1, defaultValue: 4 },
    { name: 'demandC', label: 'Потребность в доставке в п. C (q_C_need), т', min: 0, step: 0.1, defaultValue: 3 },
    { name: 'pickupC', label: 'Наличие к сбору в п. C (q_C_pick), т', min: 0, step: 0.1, defaultValue: 3 },
    { name: 'demandD', label: 'Потребность в доставке в п. D (q_D_need), т', min: 0, step: 0.1, defaultValue: 1 },
    { name: 'pickupD', label: 'Наличие к сбору в п. D (q_D_pick), т', min: 0, step: 0.1, defaultValue: 3 },
    { name: 'pointsCount', label: 'Число пунктов на маршруте (K), шт', min: 1, step: 1, defaultValue: 4 },
    { name: 'technicalSpeed', label: 'Среднетехническая скорость (Vₜ), км/ч', min: 0, step: 0.1, defaultValue: 24 },
  ],
  calculate: (values) => {
    const payloadCapacity = toNumber(values.payloadCapacity);
    const unloadLoadTime = toNumber(values.unloadLoadTime);
    const collectionLoadTime = toNumber(values.collectionLoadTime);
    const detourTime = toNumber(values.detourTime);
    const loadedDistance1 = toNumber(values.loadedDistance1);
    const loadedDistance2 = toNumber(values.loadedDistance2);
    const loadedDistance3 = toNumber(values.loadedDistance3);
    const loadedDistance4 = toNumber(values.loadedDistance4);
    const demandB = toNumber(values.demandB);
    const pickupB = toNumber(values.pickupB);
    const demandC = toNumber(values.demandC);
    const pickupC = toNumber(values.pickupC);
    const demandD = toNumber(values.demandD);
    const pickupD = toNumber(values.pickupD);
    const pointsCount = toNumber(values.pointsCount);
    const technicalSpeed = toNumber(values.technicalSpeed);

    const routeLength = loadedDistance1 + loadedDistance2 + loadedDistance3 + loadedDistance4;

    const timePerTurn = safeDivide(routeLength, technicalSpeed) + unloadLoadTime + collectionLoadTime + detourTime * Math.max(pointsCount - 2, 0);

    const totalDelivered = demandB + demandC + demandD;
    const totalPicked = pickupB + pickupC + pickupD;

    const loadLeg1 = totalDelivered; // после пункта A доставляем на B
    const loadLeg2 = loadLeg1 - demandB + pickupB;
    const loadLeg3 = loadLeg2 - demandC + pickupC;
    const loadLeg4 = loadLeg3 - demandD + pickupD;

    const tonKilometres =
      loadLeg1 * loadedDistance1 +
      loadLeg2 * loadedDistance2 +
      loadLeg3 * loadedDistance3 +
      Math.abs(loadLeg4) * loadedDistance4;

    const tonnagePerTurn = totalDelivered + Math.abs(loadLeg4);

    return {
      'Длина маршрута lₘ = l_g₁ + l_g₂ + l_g₃ + l_g₄, км': formatNumber(routeLength),
      'Время оборота tₒ,д = (lₘ/Vₜ) + tₚₚᵥ + tₛₚᵥ + t_z·(K−2), ч': formatNumber(timePerTurn),
      'Выработка за оборот Qₒ,д = q_A + |−q_A|, т': formatNumber(tonnagePerTurn),
      'Тонно-километры за оборот Pₒ,д, т·км': formatNumber(tonKilometres),
      'Tн факт (фактическое время в наряде), ч': formatNumber(timePerTurn),
      'Доставлено всего (q_B_need + q_C_need + q_D_need), т': formatNumber(totalDelivered),
      'Собрано всего (q_B_pick + q_C_pick + q_D_pick), т': formatNumber(totalPicked),
      'Загрузка на плечах (после операций)': [
        { плечо: 'A→B', загрузка: formatNumber(loadLeg1) },
        { плечо: 'B→C', загрузка: formatNumber(loadLeg2) },
        { плечо: 'C→D', загрузка: formatNumber(loadLeg3) },
        { плечо: 'D→A', загрузка: formatNumber(loadLeg4) },
      ],
      'Соотношение полезной массы к грузоподъёмности (q_A / q)': formatNumber(safeDivide(totalDelivered, payloadCapacity)),
    };
  },
};

export { method8 };
