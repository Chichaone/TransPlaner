import { formatNumber, safeDivide, toNumber } from '../utils.js';

const method4 = {
  id: 'pendulum-unequal-load',
  name: '2.1.3. Маятниковый маршрут с обратным гружёным пробегом (γ₁ ≠ γ₂)',
  description:
    'Методика 2.1.3 рассчитывает маятниковый маршрут с различными коэффициентами использования грузоподъёмности по направлениям.',
  inputs: [
    { name: 'payloadCapacity', label: 'Грузоподъёмность автомобиля (q), т', min: 0, step: 0.1 },
    {
      name: 'loadFactorForward',
      label: 'Коэффициент использования грузоподъёмности в прямом направлении (γ₁)',
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      name: 'loadFactorReturn',
      label: 'Коэффициент использования грузоподъёмности в обратном направлении (γ₂)',
      min: 0,
      max: 1,
      step: 0.01,
    },
    { name: 'shiftDuration', label: 'Плановое время в наряде (Tₙ), ч', min: 0, step: 0.1 },
    { name: 'serviceTime', label: 'Время на погрузку-выгрузку (tₚᵥ), ч', min: 0, step: 0.1 },
    { name: 'forwardDistance', label: 'Расстояние перевозки груза в прямом направлении (l_g₁), км', min: 0, step: 0.1 },
    { name: 'returnDistance', label: 'Расстояние перевозки груза в обратном направлении (l_g₂), км', min: 0, step: 0.1 },
    { name: 'zeroRun1', label: 'Первый нулевой пробег (lₙ₁), км', min: 0, step: 0.1 },
    { name: 'zeroRun2', label: 'Второй нулевой пробег (lₙ₂), км', min: 0, step: 0.1 },
    { name: 'technicalSpeed', label: 'Среднетехническая скорость (Vₜ), км/ч', min: 0, step: 0.1 },
  ],
  calculate: (values) => {
    const payloadCapacity = toNumber(values.payloadCapacity);
    const loadFactorForward = toNumber(values.loadFactorForward);
    const loadFactorReturn = toNumber(values.loadFactorReturn);
    const shiftDuration = toNumber(values.shiftDuration);
    const serviceTime = toNumber(values.serviceTime);
    const forwardDistance = toNumber(values.forwardDistance);
    const returnDistance = toNumber(values.returnDistance);
    const zeroRun1 = toNumber(values.zeroRun1);
    const zeroRun2 = toNumber(values.zeroRun2);
    const technicalSpeed = toNumber(values.technicalSpeed);

    const routeLength = forwardDistance + returnDistance;
    const firstTripTime = safeDivide(forwardDistance, technicalSpeed) + serviceTime;
    const secondTripTime = safeDivide(returnDistance, technicalSpeed) + serviceTime;
    const cycleTime = firstTripTime + secondTripTime;

    const tonnageFirstTrip = payloadCapacity * loadFactorForward;
    const tonnageSecondTrip = payloadCapacity * loadFactorReturn;
    const tonnagePerCycle = tonnageFirstTrip + tonnageSecondTrip;

    const tonKmFirstTrip = tonnageFirstTrip * forwardDistance;
    const tonKmSecondTrip = tonnageSecondTrip * returnDistance;
    const tonKmPerCycle = tonKmFirstTrip + tonKmSecondTrip;

    const theoreticalTurns = safeDivide(shiftDuration, cycleTime);
    const wholeTurns = Math.floor(theoreticalTurns);
    const deltaTime = shiftDuration - wholeTurns * cycleTime;
    const requiredTime = safeDivide(forwardDistance, technicalSpeed) + serviceTime;
    const canPerformExtraTrip = technicalSpeed > 0 && deltaTime >= requiredTime;

    const tripsForward = wholeTurns + (canPerformExtraTrip ? 1 : 0);
    const tripsReturn = wholeTurns;
    const totalTrips = tripsForward + tripsReturn;
    const actualTurns = wholeTurns + (canPerformExtraTrip ? 0.5 : 0);

    const totalTonnage = tonnageFirstTrip * tripsForward + tonnageSecondTrip * tripsReturn;
    const tonKilometres =
      tonKmFirstTrip * tripsForward + tonKmSecondTrip * tripsReturn;

    const distanceBase = routeLength * actualTurns;
    const totalDistance = Number.isInteger(actualTurns)
      ? zeroRun1 + distanceBase + zeroRun1
      : zeroRun1 + distanceBase + zeroRun2;

    const totalServiceTime = serviceTime * totalTrips;
    const actualShiftTime = safeDivide(totalDistance, technicalSpeed) + totalServiceTime;

    const betaDay = safeDivide(
      forwardDistance * tripsForward + returnDistance * tripsReturn,
      totalDistance,
    );

    return {
      'Длина маршрута (lₘ = l_g₁ + l_g₂), км': formatNumber(routeLength),
      'Время первой ездки (tₑ₁), ч': formatNumber(firstTripTime),
      'Время второй ездки (tₑ₂), ч': formatNumber(secondTripTime),
      'Время оборота (tₒ), ч': formatNumber(cycleTime),
      'Выработка первой ездки (Qₑ₁), т': formatNumber(tonnageFirstTrip),
      'Выработка второй ездки (Qₑ₂), т': formatNumber(tonnageSecondTrip),
      'Выработка за оборот (Qₒ), т': formatNumber(tonnagePerCycle),
      'Тонно-километры первой ездки (Pₑ₁), ткм': formatNumber(tonKmFirstTrip),
      'Тонно-километры второй ездки (Pₑ₂), ткм': formatNumber(tonKmSecondTrip),
      'Тонно-километры за оборот (Pₒ), ткм': formatNumber(tonKmPerCycle),
      'Теоретическое число оборотов (Zₒ = Tₙ / tₒ)': formatNumber(theoreticalTurns, 2),
      'Целое число оборотов [Tₙ / tₒ], шт': wholeTurns,
      'Остаток времени после целых оборотов (ΔTₙ), ч': formatNumber(deltaTime),
      'Необходимое время дополнительной ездки (tₑₙ), ч': formatNumber(requiredTime),
      'Решение о дополнительной ездке': canPerformExtraTrip ? 'выполнима' : 'не выполнима',
      'Число ездок на l_g₁ (Zₑ₁), шт': tripsForward,
      'Число ездок на l_g₂ (Zₑ₂), шт': tripsReturn,
      'Выработка в тоннах за смену (Qₙ), т': formatNumber(totalTonnage),
      'Тонно-километры за смену (Pₙ), ткм': formatNumber(tonKilometres),
      'Общий пробег за смену (Lₒбщ), км': formatNumber(totalDistance),
      'Фактическое время в наряде (Tₙ факт), ч': formatNumber(actualShiftTime),
      'Коэффициент использования пробега за любую ездку (βₑ)': formatNumber(1, 0),
      'Коэффициент использования пробега за оборот (βₒ)': formatNumber(1, 0),
      'Коэффициент использования пробега за день (βд)': formatNumber(betaDay, 3),
    };
  },
};

export { method4 };
