import { formatNumber, safeDivide, toNumber } from '../utils.js';

const method1 = {
  id: 'pendulum-empty-return',
  name: '1. Маятниковый маршрут с обратным не гружёным пробегом',
  description:
    'Методика рассчитывает показатели работы автомобиля на маятниковом маршруте с холостым обратным пробегом.',
  inputs: [
    { name: 'payloadCapacity', label: 'Грузоподъёмность автомобиля, т', min: 0, step: 0.1 },
    { name: 'loadFactor', label: 'Коэффициент использования грузоподъёмности', min: 0, max: 1, step: 0.01 },
    { name: 'shiftDuration', label: 'Плановое время в наряде, ч', min: 0, step: 0.1 },
    { name: 'serviceTime', label: 'Время на погрузку-выгрузку, ч', min: 0, step: 0.1 },
    { name: 'loadedDistance', label: 'Расстояние перевозки груза, км', min: 0, step: 0.1 },
    { name: 'zeroRun1', label: 'Первый нулевой пробег, км', min: 0, step: 0.1 },
    { name: 'zeroRun2', label: 'Второй нулевой пробег, км', min: 0, step: 0.1 },
    { name: 'emptyDistance', label: 'Холостой пробег, км', min: 0, step: 0.1 },
    { name: 'technicalSpeed', label: 'Среднетехническая скорость, км/ч', min: 0, step: 0.1 },
  ],
  calculate: (values) => {
    const payloadCapacity = toNumber(values.payloadCapacity);
    const loadFactor = toNumber(values.loadFactor);
    const shiftDuration = toNumber(values.shiftDuration);
    const serviceTime = toNumber(values.serviceTime);
    const loadedDistance = toNumber(values.loadedDistance);
    const zeroRun1 = toNumber(values.zeroRun1);
    const zeroRun2 = toNumber(values.zeroRun2);
    const emptyDistance = toNumber(values.emptyDistance);
    const technicalSpeed = toNumber(values.technicalSpeed);

    const routeLength = loadedDistance + emptyDistance;
    const tripTime = safeDivide(routeLength, technicalSpeed) + serviceTime;
    const tonnagePerTrip = payloadCapacity * loadFactor;
    const tonKmPerTrip = payloadCapacity * loadFactor * loadedDistance;

    const theoreticalTrips = safeDivide(shiftDuration, tripTime);
    const wholeTrips = Math.floor(theoreticalTrips);
    const deltaTime = shiftDuration - wholeTrips * tripTime;
    const requiredTime = safeDivide(loadedDistance, technicalSpeed) + serviceTime;
    const canPerformExtraTrip = technicalSpeed > 0 && deltaTime >= requiredTime;

    const actualTrips = wholeTrips + (canPerformExtraTrip ? 1 : 0);

    const totalTonnage = tonnagePerTrip * actualTrips;
    const totalTonKm = tonKmPerTrip * actualTrips;

    const totalDistanceBase = zeroRun1 + routeLength * actualTrips + zeroRun2;
    const totalDistance = Math.max(
      totalDistanceBase - (actualTrips > 0 ? emptyDistance : 0),
      0,
    );

    const actualShiftTime = safeDivide(totalDistance, technicalSpeed) + serviceTime * actualTrips;

    const betaTrip = safeDivide(loadedDistance, routeLength);
    const betaDay = safeDivide(loadedDistance * actualTrips, totalDistance);

    return {
      'Длина маршрута (lₘ = l_g + lₓ), км': formatNumber(routeLength),
      'Время ездки (tₑ,ₒ), ч': formatNumber(tripTime),
      'Выработка за ездку (Qₑ,ₒ), т': formatNumber(tonnagePerTrip),
      'Тонно-километры за ездку (Pₑ,ₒ), т·км': formatNumber(tonKmPerTrip),
      'Теоретическое число ездок (Tₙ / tₑ,ₒ)': formatNumber(theoreticalTrips, 2),
      'Целое число ездок [Tₙ / tₑ,ₒ], шт': wholeTrips,
      'Остаток времени после целых ездок (ΔTₙ), ч': formatNumber(deltaTime),
      'Необходимое время дополнительной ездки (tₑₙ), ч': formatNumber(requiredTime),
      'Решение о дополнительной ездке': canPerformExtraTrip ? 'выполнима' : 'не выполнима',
      'Фактическое число ездок (Zₑ,ₒ факт), шт': actualTrips,
      'Выработка в тоннах за смену (Qₙ), т': formatNumber(totalTonnage),
      'Тонно-километры за смену (Pₙ), т·км': formatNumber(totalTonKm),
      'Общий пробег за смену (Lₒбщ), км': formatNumber(totalDistance),
      'Фактическое время в наряде (Tₙ факт), ч': formatNumber(actualShiftTime),
      'Коэффициент использования пробега за ездку (βₑ,ₒ)': formatNumber(betaTrip, 3),
      'Коэффициент использования пробега за день (βд)': formatNumber(betaDay, 3),
    };
  },
};

export { method1 };
