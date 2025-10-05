import { formatNumber, safeDivide, toNumber } from '../utils.js';

const method5 = {
  id: 'ring-route',
  name: '5. Кольцевой маршрут',
  description:
    'Методика описывает расчёт показателей работы автомобиля на кольцевом маршруте с двумя гружёными и двумя холостыми участками.',
  inputs: [
    { name: 'payloadCapacity', label: 'Грузоподъёмность автомобиля (q), т', min: 0, step: 0.1 },
    {
      name: 'staticLoadFactor',
      label: 'Коэффициент статического использования грузоподъёмности (γ)',
      min: 0,
      max: 1,
      step: 0.01,
    },
    { name: 'shiftDuration', label: 'Плановое время в наряде (Tₙ), ч', min: 0, step: 0.1 },
    { name: 'serviceTime', label: 'Время на погрузку-выгрузку (tₚᵥ), ч', min: 0, step: 0.1 },
    { name: 'loadedDistance1', label: 'Первый гружёный пробег (l_g₁), км', min: 0, step: 0.1 },
    { name: 'loadedDistance2', label: 'Второй гружёный пробег (l_g₂), км', min: 0, step: 0.1 },
    { name: 'zeroRun1', label: 'Первый нулевой пробег (lₙ₁), км', min: 0, step: 0.1 },
    { name: 'zeroRun2', label: 'Второй нулевой пробег (lₙ₂), км', min: 0, step: 0.1 },
    { name: 'zeroRun3', label: 'Третий нулевой пробег (lₙ₃), км', min: 0, step: 0.1 },
    { name: 'emptyRun1', label: 'Первый холостой пробег (lₓ₁), км', min: 0, step: 0.1 },
    { name: 'emptyRun2', label: 'Второй холостой пробег (lₓ₂), км', min: 0, step: 0.1 },
    { name: 'technicalSpeed', label: 'Среднетехническая скорость (Vₜ), км/ч', min: 0, step: 0.1 },
  ],
  calculate: (values) => {
    const payloadCapacity = toNumber(values.payloadCapacity);
    const staticLoadFactor = toNumber(values.staticLoadFactor);
    const shiftDuration = toNumber(values.shiftDuration);
    const serviceTime = toNumber(values.serviceTime);
    const loadedDistance1 = toNumber(values.loadedDistance1);
    const loadedDistance2 = toNumber(values.loadedDistance2);
    const zeroRun1 = toNumber(values.zeroRun1);
    const zeroRun2 = toNumber(values.zeroRun2);
    const zeroRun3 = toNumber(values.zeroRun3);
    const emptyRun1 = toNumber(values.emptyRun1);
    const emptyRun2 = toNumber(values.emptyRun2);
    const technicalSpeed = toNumber(values.technicalSpeed);

    const routeLength = loadedDistance1 + emptyRun1 + loadedDistance2 + emptyRun2;
    const firstTripTime = safeDivide(loadedDistance1 + emptyRun1, technicalSpeed) + serviceTime;
    const secondTripTime = safeDivide(loadedDistance2 + emptyRun2, technicalSpeed) + serviceTime;
    const cycleTime = firstTripTime + secondTripTime;

    const tonnageFirstTrip = payloadCapacity * staticLoadFactor;
    const tonnageSecondTrip = payloadCapacity * staticLoadFactor;
    const tonnagePerCycle = tonnageFirstTrip + tonnageSecondTrip;

    const tonKmFirstTrip = payloadCapacity * staticLoadFactor * loadedDistance1;
    const tonKmSecondTrip = payloadCapacity * staticLoadFactor * loadedDistance2;
    const tonKmPerCycle = tonKmFirstTrip + tonKmSecondTrip;

    const theoreticalTurns = safeDivide(shiftDuration, cycleTime);
    const wholeTurns = Math.floor(theoreticalTurns);
    const deltaTime = shiftDuration - wholeTurns * cycleTime;
    const requiredSecondTripTime =
      safeDivide(loadedDistance2, technicalSpeed) + serviceTime;
    const canPerformExtraSecondTrip = technicalSpeed > 0 && deltaTime >= requiredSecondTripTime;

    const tripsFirst = wholeTurns;
    const tripsSecond = wholeTurns + (canPerformExtraSecondTrip ? 1 : 0);
    const totalTrips = tripsFirst + tripsSecond;
    const actualTurns = wholeTurns + (canPerformExtraSecondTrip ? 0.5 : 0);

    const totalTonnage = tonnageFirstTrip * tripsFirst + tonnageSecondTrip * tripsSecond;
    const tonKilometres =
      tonKmFirstTrip * tripsFirst + tonKmSecondTrip * tripsSecond;

    const distanceBase = zeroRun1 + routeLength * actualTurns;
    const distanceWithEnding = Number.isInteger(actualTurns)
      ? distanceBase + zeroRun3 - emptyRun2
      : distanceBase + zeroRun2 - emptyRun1;
    const totalDistance = Math.max(distanceWithEnding, 0);

    const totalServiceTime = serviceTime * (tripsFirst + tripsSecond);
    const actualShiftTime = safeDivide(totalDistance, technicalSpeed) + totalServiceTime;

    const betaTrip1 = safeDivide(loadedDistance1, loadedDistance1 + emptyRun1);
    const betaTrip2 = safeDivide(loadedDistance2, loadedDistance2 + emptyRun2);
    const betaCycle = safeDivide(loadedDistance1 + loadedDistance2, routeLength);
    const betaDay = safeDivide(
      loadedDistance1 * tripsFirst + loadedDistance2 * tripsSecond,
      totalDistance,
    );

    const actualTurnsDisplay = Math.round(actualTurns * 2) / 2;

    return {
      'Длина маршрута (lₘ = l_g₁ + lₓ₁ + l_g₂ + lₓ₂), км': formatNumber(routeLength),
      'Время первой ездки (tₑ₁), ч': formatNumber(firstTripTime),
      'Время второй ездки (tₑ₂), ч': formatNumber(secondTripTime),
      'Время оборота (tₒ), ч': formatNumber(cycleTime),
      'Выработка первой ездки (Qₑ₁), т': formatNumber(tonnageFirstTrip),
      'Выработка второй ездки (Qₑ₂), т': formatNumber(tonnageSecondTrip),
      'Выработка за оборот (Qₒ), т': formatNumber(tonnagePerCycle),
      'Тонно-километры первой ездки (Pₑ₁), ткм': formatNumber(tonKmFirstTrip),
      'Тонно-километры второй ездки (Pₑ₂), ткм': formatNumber(tonKmSecondTrip),
      'Тонно-километры за оборот (Pₒ), ткм': formatNumber(tonKmPerCycle),
      'Теоретическое число оборотов (Tₙ / tₒ)': formatNumber(theoreticalTurns, 2),
      'Целое число оборотов [Tₙ / tₒ], шт': wholeTurns,
      'Фактическое число оборотов (Zₒ факт), шт': formatNumber(actualTurnsDisplay, 1),
      'Остаток времени после целых оборотов (ΔTₙ), ч': formatNumber(deltaTime),
      'Необходимое время второй ездки (tₑₙ₂), ч': formatNumber(requiredSecondTripTime),
      'Решение о дополнительной ездке': canPerformExtraSecondTrip ? 'выполнима' : 'не выполнима',
      'Число ездок на l_g₁ (Zₑ₁), шт': tripsFirst,
      'Число ездок на l_g₂ (Zₑ₂), шт': tripsSecond,
      'Выработка в тоннах за смену (Qₙ), т': formatNumber(totalTonnage),
      'Тонно-километры за смену (Pₙ), ткм': formatNumber(tonKilometres),
      'Общий пробег за смену (Lₒбщ), км': formatNumber(totalDistance),
      'Фактическое время в наряде (Tₙ факт), ч': formatNumber(actualShiftTime),
      'Коэффициент использования пробега первой ездки (βₑ₁)': formatNumber(betaTrip1, 3),
      'Коэффициент использования пробега второй ездки (βₑ₂)': formatNumber(betaTrip2, 3),
      'Коэффициент использования пробега за оборот (βₒ)': formatNumber(betaCycle, 3),
      'Коэффициент использования пробега за день (βд)': formatNumber(betaDay, 3),
    };
  },
};

export { method5 };
