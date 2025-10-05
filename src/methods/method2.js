import { formatNumber, safeDivide, toNumber } from '../utils.js';

const method2 = {
  id: 'pendulum-partial-loaded',
  name: '2.1.1. Маятниковый маршрут с обратным гружёным пробегом не на всём расстоянии (γ₁ = γ₂)',
  description:
    'Методика 2.1.1 учитывает гружёные плечи и холостой участок на обратном пути при расчёте сменных показателей.',
  inputs: [
    { name: 'payloadCapacity', label: 'Грузоподъёмность автомобиля (q), т', min: 0, step: 0.1 },
    { name: 'loadFactor', label: 'Коэффициент использования грузоподъёмности (γ)', min: 0, max: 1, step: 0.01 },
    { name: 'shiftDuration', label: 'Плановое время в наряде (Tₙ), ч', min: 0, step: 0.1 },
    { name: 'serviceTime', label: 'Время на погрузку-выгрузку (tₚᵥ), ч', min: 0, step: 0.1 },
    { name: 'forwardDistance', label: 'Расстояние перевозки груза в прямом направлении (l_g₁), км', min: 0, step: 0.1 },
    { name: 'returnDistance', label: 'Расстояние перевозки груза в обратном направлении (l_g₂), км', min: 0, step: 0.1 },
    { name: 'zeroRun1', label: 'Первый нулевой пробег (lₙ₁), км', min: 0, step: 0.1 },
    { name: 'zeroRun2', label: 'Второй нулевой пробег (lₙ₂), км', min: 0, step: 0.1 },
    { name: 'zeroRun3', label: 'Третий нулевой пробег (lₙ₃), км', min: 0, step: 0.1 },
    { name: 'emptyDistance', label: 'Холостой пробег (lₓ₂), км', min: 0, step: 0.1 },
    { name: 'technicalSpeed', label: 'Среднетехническая скорость (Vₜ), км/ч', min: 0, step: 0.1 },
  ],
  calculate: (values) => {
    const payloadCapacity = toNumber(values.payloadCapacity);
    const loadFactor = toNumber(values.loadFactor);
    const shiftDuration = toNumber(values.shiftDuration);
    const serviceTime = toNumber(values.serviceTime);
    const forwardDistance = toNumber(values.forwardDistance);
    const returnDistance = toNumber(values.returnDistance);
    const zeroRun1 = toNumber(values.zeroRun1);
    const zeroRun2 = toNumber(values.zeroRun2);
    const zeroRun3 = toNumber(values.zeroRun3);
    const emptyDistance = toNumber(values.emptyDistance);
    const technicalSpeed = toNumber(values.technicalSpeed);

    const routeLength = forwardDistance + returnDistance + emptyDistance;
    const firstTripTime = safeDivide(forwardDistance, technicalSpeed) + serviceTime;
    const secondTripTime = safeDivide(returnDistance + emptyDistance, technicalSpeed) + serviceTime;
    const cycleTime = firstTripTime + secondTripTime;

    const tonnagePerTrip = payloadCapacity * loadFactor;
    const tonnagePerCycle = tonnagePerTrip * 2;
    const tonKmFirstTrip = payloadCapacity * loadFactor * forwardDistance;
    const tonKmSecondTrip = payloadCapacity * loadFactor * returnDistance;
    const tonKmPerCycle = tonKmFirstTrip + tonKmSecondTrip;

    const theoreticalTurns = safeDivide(shiftDuration, cycleTime);
    const wholeTurns = Math.floor(theoreticalTurns);
    const deltaTime = shiftDuration - wholeTurns * cycleTime;
    const requiredTime = safeDivide(forwardDistance, technicalSpeed) + serviceTime;
    const canPerformExtraTrip = technicalSpeed > 0 && deltaTime >= requiredTime;

    const tripsPerTurn = 2;
    const baseTrips = wholeTurns * tripsPerTurn;
    const tripsForward = wholeTurns + (canPerformExtraTrip ? 1 : 0);
    const tripsReturn = wholeTurns;
    const totalTrips = tripsForward + tripsReturn;
    const actualTurns = wholeTurns + (canPerformExtraTrip ? 0.5 : 0);

    const totalTonnage = tonnagePerTrip * totalTrips;
    const tonKilometres = payloadCapacity * loadFactor * (
      tripsForward * forwardDistance + tripsReturn * returnDistance,
    );

    const distanceBase = zeroRun1 + routeLength * actualTurns;
    const totalDistance = Number.isInteger(actualTurns)
      ? distanceBase + zeroRun3 - emptyDistance
      : distanceBase + zeroRun2;

    const actualShiftTime = safeDivide(totalDistance, technicalSpeed) + serviceTime * totalTrips;

    const betaFirstTrip = 1;
    const betaSecondTrip = safeDivide(returnDistance, returnDistance + emptyDistance);
    const betaCycle = safeDivide(forwardDistance + returnDistance, routeLength);
    const betaDay = safeDivide(
      forwardDistance * tripsForward + returnDistance * tripsReturn,
      totalDistance,
    );

    return {
      'Длина маршрута (lₘ = l_g₁ + l_g₂ + lₓ₂), км': formatNumber(routeLength),
      'Время первой ездки (tₑ₁), ч': formatNumber(firstTripTime),
      'Время второй ездки (tₑ₂), ч': formatNumber(secondTripTime),
      'Время оборота (tₒ), ч': formatNumber(cycleTime),
      'Выработка за любую ездку (Qₑ), т': formatNumber(tonnagePerTrip),
      'Выработка за оборот (Qₒ), т': formatNumber(tonnagePerCycle),
      'Тонно-километры первой ездки (Pₑ₁), ткм': formatNumber(tonKmFirstTrip),
      'Тонно-километры второй ездки (Pₑ₂), ткм': formatNumber(tonKmSecondTrip),
      'Тонно-километры за оборот (Pₒ), ткм': formatNumber(tonKmPerCycle),
      'Теоретическое число оборотов (Zₒ = Tₙ / tₒ)': formatNumber(theoreticalTurns, 2),
      'Целое число оборотов [Tₙ / tₒ], шт': wholeTurns,
      'Остаток времени после целых оборотов (ΔTₙ), ч': formatNumber(deltaTime),
      'Необходимое время дополнительной ездки (tₑₙ), ч': formatNumber(requiredTime),
      'Решение о дополнительной ездке': canPerformExtraTrip ? 'выполнима' : 'не выполнима',
      'Число ездок с учётом проверки (Zₑ факт), шт': totalTrips,
      'Число ездок на l_g₁ (Zₑ₁), шт': tripsForward,
      'Число ездок на l_g₂ (Zₑ₂), шт': tripsReturn,
      'Выработка в тоннах за смену (Qₙ), т': formatNumber(totalTonnage),
      'Тонно-километры за смену (Pₙ), ткм': formatNumber(tonKilometres),
      'Общий пробег за смену (Lₒбщ), км': formatNumber(totalDistance),
      'Фактическое время в наряде (Tₙ факт), ч': formatNumber(actualShiftTime),
      'Коэффициент использования пробега первой ездки (βₑ₁)': formatNumber(betaFirstTrip, 3),
      'Коэффициент использования пробега второй ездки (βₑ₂)': formatNumber(betaSecondTrip, 3),
      'Коэффициент использования пробега за день (βд)': formatNumber(betaDay, 3),
      'Коэффициент использования пробега за оборот (βₒ)': formatNumber(betaCycle, 3),
    };
  },
};

export { method2 };
