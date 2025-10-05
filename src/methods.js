const toNumber = (value) => {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
};

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const formatNumber = (value, digits = 2) => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return round(value, digits).toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const safeDivide = (numerator, denominator) => {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
};

const computeCycleMetrics = ({
  segments,
  serviceTime,
  shiftDuration,
  prepTime,
  payloads,
}) => {
  const totalDrivingTime = segments.reduce((acc, seg) => acc + seg.distance / seg.speed, 0);
  const cycleTime = totalDrivingTime + serviceTime;
  const effectiveShift = Math.max(shiftDuration - prepTime, 0);
  const trips = Math.floor(effectiveShift / cycleTime);
  const remainingTime = effectiveShift - trips * cycleTime;

  const totalDistance = trips * segments.reduce((acc, seg) => acc + seg.distance, 0);
  const loadedDistance = trips * segments
    .filter((seg) => seg.loadFactor > 0)
    .reduce((acc, seg) => acc + seg.distance * seg.loadFactor, 0);

  const tonnagePerCycle = payloads.reduce((acc, payload) => acc + payload, 0);
  const totalTonnage = trips * tonnagePerCycle;
  const tonKilometresPerCycle = segments.reduce(
    (acc, seg, index) => acc + seg.distance * (payloads[index] ?? 0),
    0,
  );
  const totalTonKilometres = trips * tonKilometresPerCycle;

  const actualShiftTime = prepTime + trips * cycleTime;

  const betaTrip = safeDivide(
    segments.filter((seg) => seg.loadFactor > 0).reduce((acc, seg) => acc + seg.distance, 0),
    segments.reduce((acc, seg) => acc + seg.distance, 0),
  );
  const betaDay = safeDivide(loadedDistance, totalDistance);

  return {
    totalDrivingTime,
    cycleTime,
    effectiveShift,
    trips,
    remainingTime,
    totalDistance,
    loadedDistance,
    totalTonnage,
    tonKilometres: totalTonKilometres,
    actualShiftTime,
    betaTrip,
    betaDay,
  };
};

const methods = [
  {
    id: 'pendulum-partial-loaded',
    name: '2.1.1. Маятниковый маршрут с обратным гружёным пробегом не на всём расстоянии (γ₁ = γ₂)',
    description:
      'Методика 2.1.1 учитывает два гружёных плеча маятникового маршрута и холостой участок на обратном пути. Заполните исходные данные из таблицы задания и получите показатели сменной работы автомобиля.',
    inputs: [
      { name: 'payloadCapacity', label: 'Грузоподъёмность автомобиля (q), т', min: 0, step: 0.1 },
      { name: 'loadFactor', label: 'Коэффициент использования грузоподъёмности (γ)', min: 0, step: 0.01, max: 1 },
      { name: 'shiftDuration', label: 'Плановое время в наряде (Tₙ), ч', min: 0, step: 0.1 },
      { name: 'serviceTime', label: 'Время на погрузку-выгрузку (tₚᵥ), ч', min: 0, step: 0.1 },
      { name: 'forwardLoadedDistance', label: 'Расстояние перевозки груза в прямом направлении (l_g₁), км', min: 0, step: 0.1 },
      { name: 'returnLoadedDistance', label: 'Расстояние перевозки груза в обратном направлении (l_g₂), км', min: 0, step: 0.1 },
      { name: 'zeroRun1', label: 'Первый нулевой пробег (lₙ₁), км', min: 0, step: 0.1 },
      { name: 'zeroRun2', label: 'Второй нулевой пробег (lₙ₂), км', min: 0, step: 0.1 },
      { name: 'zeroRun3', label: 'Третий нулевой пробег (lₙ₃), км', min: 0, step: 0.1 },
      { name: 'emptyReturnDistance', label: 'Холостой пробег (lₓ₂), км', min: 0, step: 0.1 },
      { name: 'technicalSpeed', label: 'Среднетехническая скорость (Vₜ), км/ч', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const payloadCapacity = toNumber(values.payloadCapacity);
      const loadFactor = toNumber(values.loadFactor);
      const shiftDuration = toNumber(values.shiftDuration);
      const serviceTime = toNumber(values.serviceTime);
      const forwardLoadedDistance = toNumber(values.forwardLoadedDistance);
      const returnLoadedDistance = toNumber(values.returnLoadedDistance);
      const zeroRun1 = toNumber(values.zeroRun1);
      const zeroRun2 = toNumber(values.zeroRun2);
      const zeroRun3 = toNumber(values.zeroRun3);
      const emptyReturnDistance = toNumber(values.emptyReturnDistance);
      const technicalSpeed = toNumber(values.technicalSpeed);

      const routeLength = forwardLoadedDistance + returnLoadedDistance + emptyReturnDistance;

      const firstTripTime = safeDivide(forwardLoadedDistance, technicalSpeed) + serviceTime;
      const secondTripTime = safeDivide(returnLoadedDistance + emptyReturnDistance, technicalSpeed) + serviceTime;
      const cycleTime = firstTripTime + secondTripTime;

      const tonnagePerTrip = payloadCapacity * loadFactor;
      const tonnagePerCycle = tonnagePerTrip * 2;

      const tonKmFirstTrip = payloadCapacity * loadFactor * forwardLoadedDistance;
      const tonKmSecondTrip = payloadCapacity * loadFactor * returnLoadedDistance;
      const tonKmPerCycle = tonKmFirstTrip + tonKmSecondTrip;

      const theoreticalCycles = safeDivide(shiftDuration, cycleTime);
      const fullCycles = Math.floor(theoreticalCycles);
      const deltaTime = shiftDuration - fullCycles * cycleTime;
      const requiredTimeForExtraTrip = firstTripTime;
      const canPerformExtraTrip = deltaTime >= requiredTimeForExtraTrip && technicalSpeed > 0;

      const totalCycles = fullCycles + (canPerformExtraTrip ? 0.5 : 0);
      const tripsPerCycle = 2;
      const baseTrips = fullCycles * tripsPerCycle;
      const totalTrips = baseTrips + (canPerformExtraTrip ? 1 : 0);
      const tripsForward = fullCycles + (canPerformExtraTrip ? 1 : 0);
      const tripsReturn = fullCycles;

      const totalTonnage = tonnagePerTrip * totalTrips;
      const tonKilometres = payloadCapacity * loadFactor * (
        tripsForward * forwardLoadedDistance + tripsReturn * returnLoadedDistance
      );

      const totalDistance = Number.isInteger(totalCycles)
        ? zeroRun1 + routeLength * totalCycles + zeroRun3 - emptyReturnDistance
        : zeroRun1 + routeLength * totalCycles + zeroRun2;

      const actualShiftTime = safeDivide(totalDistance, technicalSpeed) + serviceTime * totalTrips;

      const betaFirstTrip = forwardLoadedDistance ? 1 : 0;
      const betaSecondTrip = safeDivide(returnLoadedDistance, returnLoadedDistance + emptyReturnDistance);
      const betaDay = safeDivide(
        forwardLoadedDistance * tripsForward + returnLoadedDistance * tripsReturn,
        totalDistance,
      );
      const betaCycle = safeDivide(
        forwardLoadedDistance + returnLoadedDistance,
        routeLength,
      );

      return {
        'Длина маршрута (lₘ = l_g₁ + l_g₂ + lₓ₂), км': formatNumber(routeLength),
        'Время первой ездки (tₑ₁), ч': formatNumber(firstTripTime),
        'Время второй ездки (tₑ₂), ч': formatNumber(secondTripTime),
        'Время оборота (tₒ), ч': formatNumber(cycleTime),
        'Выработка за ездку (Qₑ), т': formatNumber(tonnagePerTrip),
        'Выработка за оборот (Qₒ), т': formatNumber(tonnagePerCycle),
        'Тонно-километры первой ездки (Pₑ₁), ткм': formatNumber(tonKmFirstTrip),
        'Тонно-километры второй ездки (Pₑ₂), ткм': formatNumber(tonKmSecondTrip),
        'Тонно-километры за оборот (Pₒ), ткм': formatNumber(tonKmPerCycle),
        'Теоретическое число оборотов (Zₒ = Tₙ / tₒ)': formatNumber(theoreticalCycles, 2),
        'Фактическое число оборотов (Zₒ факт), шт': formatNumber(totalCycles, 2),
        'Целое число оборотов [Tₙ / tₒ], шт': fullCycles,
        'Число ездок за время в наряде без учёта проверки (Zₑ), шт': baseTrips,
        'Остаток времени после целых оборотов (ΔTₙ), ч': formatNumber(deltaTime),
        'Необходимое время для дополнительной ездки (tₑₙ), ч': formatNumber(requiredTimeForExtraTrip),
        'Возможность дополнительной ездки': canPerformExtraTrip ? 'выполнима' : 'не выполнима',
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
  },
  {
    id: 'pendulum-partial-return',
    name: '2.1.2. Маятниковый маршрут с обратным гружёным пробегом (γ₁ = γ₂)',
    description:
      'Методика 2.1.2 рассматривает два гружёных плеча без холостого участка и определяет сменные показатели по заданным расстояниям и времени в наряде.',
    inputs: [
      { name: 'payloadCapacity', label: 'Грузоподъёмность автомобиля (q), т', min: 0, step: 0.1 },
      { name: 'loadFactor', label: 'Коэффициент использования грузоподъёмности (γ)', min: 0, step: 0.01, max: 1 },
      { name: 'shiftDuration', label: 'Плановое время в наряде (Tₙ), ч', min: 0, step: 0.1 },
      { name: 'serviceTime', label: 'Время на погрузку-выгрузку (tₚᵥ), ч', min: 0, step: 0.1 },
      { name: 'forwardLoadedDistance', label: 'Расстояние перевозки груза в прямом направлении (l_g₁), км', min: 0, step: 0.1 },
      { name: 'returnLoadedDistance', label: 'Расстояние перевозки груза в обратном направлении (l_g₂), км', min: 0, step: 0.1 },
      { name: 'zeroRun1', label: 'Первый нулевой пробег (lₙ₁), км', min: 0, step: 0.1 },
      { name: 'zeroRun2', label: 'Второй нулевой пробег (lₙ₂), км', min: 0, step: 0.1 },
      { name: 'technicalSpeed', label: 'Среднетехническая скорость (Vₜ), км/ч', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const payloadCapacity = toNumber(values.payloadCapacity);
      const loadFactor = toNumber(values.loadFactor);
      const shiftDuration = toNumber(values.shiftDuration);
      const serviceTime = toNumber(values.serviceTime);
      const forwardLoadedDistance = toNumber(values.forwardLoadedDistance);
      const returnLoadedDistance = toNumber(values.returnLoadedDistance);
      const zeroRun1 = toNumber(values.zeroRun1);
      const zeroRun2 = toNumber(values.zeroRun2);
      const technicalSpeed = toNumber(values.technicalSpeed);

      const routeLength = forwardLoadedDistance + returnLoadedDistance;

      const firstTripTime = safeDivide(forwardLoadedDistance, technicalSpeed) + serviceTime;
      const secondTripTime = safeDivide(returnLoadedDistance, technicalSpeed) + serviceTime;
      const cycleTime = firstTripTime + secondTripTime;

      const tonnagePerTrip = payloadCapacity * loadFactor;
      const tonKmFirstTrip = payloadCapacity * loadFactor * forwardLoadedDistance;
      const tonKmSecondTrip = payloadCapacity * loadFactor * returnLoadedDistance;
      const tonKmPerCycle = tonKmFirstTrip + tonKmSecondTrip;

      const theoreticalCycles = safeDivide(shiftDuration, cycleTime);
      const fullCycles = Math.floor(theoreticalCycles);
      const deltaTime = shiftDuration - fullCycles * cycleTime;
      const requiredTimeForExtraTrip = firstTripTime;
      const canPerformExtraTrip = deltaTime >= requiredTimeForExtraTrip && technicalSpeed > 0;

      const totalCycles = fullCycles + (canPerformExtraTrip ? 0.5 : 0);
      const tripsPerCycle = 2;
      const baseTrips = fullCycles * tripsPerCycle;
      const totalTrips = baseTrips + (canPerformExtraTrip ? 1 : 0);
      const tripsForward = fullCycles + (canPerformExtraTrip ? 1 : 0);
      const tripsReturn = fullCycles;

      const totalTonnage = tonnagePerTrip * totalTrips;
      const tonKilometres =
        payloadCapacity * loadFactor * (tripsForward * forwardLoadedDistance + tripsReturn * returnLoadedDistance);

      const extraDistance = canPerformExtraTrip ? forwardLoadedDistance : 0;
      const finalZeroRun = canPerformExtraTrip ? zeroRun2 : zeroRun1;
      const totalDistance = zeroRun1 + fullCycles * routeLength + extraDistance + finalZeroRun;

      const actualShiftTime = safeDivide(totalDistance, technicalSpeed) + serviceTime * totalTrips;

      const betaDay = safeDivide(
        forwardLoadedDistance * tripsForward + returnLoadedDistance * tripsReturn,
        totalDistance,
      );

      return {
        'Длина маршрута (lₘ = l_g₁ + l_g₂), км': formatNumber(routeLength),
        'Время первой ездки (tₑ₁), ч': formatNumber(firstTripTime),
        'Время второй ездки (tₑ₂), ч': formatNumber(secondTripTime),
        'Время оборота (tₒ), ч': formatNumber(cycleTime),
        'Выработка за ездку (Qₑ), т': formatNumber(tonnagePerTrip),
        'Выработка за оборот (Qₒ), т': formatNumber(tonnagePerTrip * 2),
        'Тонно-километры первой ездки (Pₑ₁), ткм': formatNumber(tonKmFirstTrip),
        'Тонно-километры второй ездки (Pₑ₂), ткм': formatNumber(tonKmSecondTrip),
        'Тонно-километры за оборот (Pₒ), ткм': formatNumber(tonKmPerCycle),
        'Теоретическое число оборотов (Zₒ = Tₙ / tₒ)': formatNumber(theoreticalCycles, 2),
        'Фактическое число оборотов (Zₒ факт), шт': formatNumber(totalCycles, 2),
        'Целое число оборотов [Tₙ / tₒ], шт': fullCycles,
        'Число ездок за время в наряде без проверки (Zₑ), шт': baseTrips,
        'Остаток времени после целых оборотов (ΔTₙ), ч': formatNumber(deltaTime),
        'Необходимое время для дополнительной ездки (tₑₙ), ч': formatNumber(requiredTimeForExtraTrip),
        'Возможность дополнительной ездки': canPerformExtraTrip ? 'выполнима' : 'не выполнима',
        'Число ездок с учётом проверки (Zₑ факт), шт': totalTrips,
        'Число ездок на l_g₁ (Zₑ₁), шт': tripsForward,
        'Число ездок на l_g₂ (Zₑ₂), шт': tripsReturn,
        'Выработка в тоннах за смену (Qₙ), т': formatNumber(totalTonnage),
        'Тонно-километры за смену (Pₙ), ткм': formatNumber(tonKilometres),
        'Общий пробег за смену (Lₒбщ), км': formatNumber(totalDistance),
        'Фактическое время в наряде (Tₙ факт), ч': formatNumber(actualShiftTime),
        'Коэффициент использования пробега за оборот (βₒ)': formatNumber(1, 0),
        'Коэффициент использования пробега за день (βд)': formatNumber(betaDay, 3),
      };
    },
  },
  {
    id: 'pendulum-full-return',
    name: '2.1.3. Маятниковый маршрут с полностью гружёным обратным пробегом',
    description:
      'Грузовая работа выполняется в обоих направлениях. Используйте разные значения массы груза и скорости, если это необходимо.',
    inputs: [
      { name: 'distance', label: 'Расстояние между пунктами (lₙ), км', min: 0, step: 0.1 },
      { name: 'loadedSpeedForward', label: 'Скорость в прямом гружёном направлении (Vₜ₁), км/ч', min: 0, step: 0.1 },
      { name: 'loadedSpeedReturn', label: 'Скорость в обратном гружёном направлении (Vₜ₂), км/ч', min: 0, step: 0.1 },
      { name: 'loadingTime', label: 'Время погрузки (tₚ), ч', min: 0, step: 0.1 },
      { name: 'unloadingTimeForward', label: 'Время разгрузки на прямом плече (tᵣ₁), ч', min: 0, step: 0.1 },
      { name: 'unloadingTimeReturn', label: 'Время разгрузки на обратном плече (tᵣ₂), ч', min: 0, step: 0.1 },
      { name: 'prepTime', label: 'Подготовительно-заключительное время (tₚ₋ₓ), ч', min: 0, step: 0.1 },
      { name: 'shiftDuration', label: 'Продолжительность смены (Tₙ), ч', min: 0, step: 0.1 },
      { name: 'payloadForward', label: 'Масса груза в прямом направлении (q₁), т', min: 0, step: 0.1 },
      { name: 'payloadReturn', label: 'Масса груза в обратном направлении (q₂), т', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const distance = toNumber(values.distance);
      const loadedSpeedForward = toNumber(values.loadedSpeedForward);
      const loadedSpeedReturn = toNumber(values.loadedSpeedReturn);
      const loadingTime = toNumber(values.loadingTime);
      const unloadingTimeForward = toNumber(values.unloadingTimeForward);
      const unloadingTimeReturn = toNumber(values.unloadingTimeReturn);
      const prepTime = toNumber(values.prepTime);
      const shiftDuration = toNumber(values.shiftDuration);
      const payloadForward = toNumber(values.payloadForward);
      const payloadReturn = toNumber(values.payloadReturn);

      const serviceTime = loadingTime + unloadingTimeForward + unloadingTimeReturn;

      const segments = [
        { distance, speed: loadedSpeedForward, loadFactor: 1 },
        { distance, speed: loadedSpeedReturn, loadFactor: 1 },
      ];

      const payloads = [payloadForward, payloadReturn];

      const metrics = computeCycleMetrics({
        segments,
        serviceTime,
        shiftDuration,
        prepTime,
        payloads,
      });

      const routeLength = 2 * distance;

      return {
        'Длина маршрута (lₘ), км': formatNumber(routeLength),
        'Время гружёной ездки вперёд, ч': formatNumber(distance / loadedSpeedForward),
        'Время гружёной ездки обратно, ч': formatNumber(distance / loadedSpeedReturn),
        'Простои под грузовыми операциями, ч': formatNumber(serviceTime),
        'Полное время оборота (tₒб), ч': formatNumber(metrics.cycleTime),
        'Эффективное сменное время, ч': formatNumber(metrics.effectiveShift),
        'Выполнимое число ездок (Zₑ), шт': metrics.trips,
        'Остаток сменного времени (ΔTₙ), ч': formatNumber(metrics.remainingTime),
        'Общий пробег за смену (Lₒбщ), км': formatNumber(metrics.totalDistance),
        'Выработка в тоннах за смену (Qₛ), т': formatNumber(metrics.totalTonnage),
        'Тонно-километровая работа (Wₜ), ткм': formatNumber(metrics.tonKilometres),
        'Коэффициент использования пробега за ездку (βₑ,ₒ)': formatNumber(metrics.betaTrip, 3),
        'Коэффициент использования пробега за день (βд)': formatNumber(metrics.betaDay, 3),
      };
    },
  },
  {
    id: 'pendulum-different-gamma',
    name: '2.1.4. Маятниковый маршрут с разной загрузкой по направлениям (γ₁ ≠ γ₂)',
    description:
      'Методика 2.1.4 рассчитывает маятниковый маршрут с различными коэффициентами использования грузоподъёмности в каждом направлении.',
    inputs: [
      { name: 'payloadCapacity', label: 'Грузоподъёмность автомобиля (q), т', min: 0, step: 0.1 },
      { name: 'loadFactorForward', label: 'Коэффициент использования грузоподъёмности в прямом направлении (γ₁)', min: 0, step: 0.01 },
      { name: 'loadFactorReturn', label: 'Коэффициент использования грузоподъёмности в обратном направлении (γ₂)', min: 0, step: 0.01 },
      { name: 'shiftDuration', label: 'Плановое время в наряде (Tₙ), ч', min: 0, step: 0.1 },
      { name: 'serviceTime', label: 'Время на погрузку-выгрузку (tₚᵥ), ч', min: 0, step: 0.1 },
      { name: 'forwardLoadedDistance', label: 'Расстояние перевозки груза в прямом направлении (l_g₁), км', min: 0, step: 0.1 },
      { name: 'returnLoadedDistance', label: 'Расстояние перевозки груза в обратном направлении (l_g₂), км', min: 0, step: 0.1 },
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
      const forwardLoadedDistance = toNumber(values.forwardLoadedDistance);
      const returnLoadedDistance = toNumber(values.returnLoadedDistance);
      const zeroRun1 = toNumber(values.zeroRun1);
      const zeroRun2 = toNumber(values.zeroRun2);
      const technicalSpeed = toNumber(values.technicalSpeed);

      const routeLength = forwardLoadedDistance + returnLoadedDistance;

      const firstTripTime = safeDivide(forwardLoadedDistance, technicalSpeed) + serviceTime;
      const secondTripTime = safeDivide(returnLoadedDistance, technicalSpeed) + serviceTime;
      const cycleTime = firstTripTime + secondTripTime;

      const tonnageFirstTrip = payloadCapacity * loadFactorForward;
      const tonnageSecondTrip = payloadCapacity * loadFactorReturn;
      const tonnagePerCycle = tonnageFirstTrip + tonnageSecondTrip;

      const tonKmFirstTrip = tonnageFirstTrip * forwardLoadedDistance;
      const tonKmSecondTrip = tonnageSecondTrip * returnLoadedDistance;
      const tonKmPerCycle = tonKmFirstTrip + tonKmSecondTrip;

      const theoreticalCycles = safeDivide(shiftDuration, cycleTime);
      const fullCycles = Math.floor(theoreticalCycles);
      const deltaTime = shiftDuration - fullCycles * cycleTime;
      const requiredTimeForExtraTrip = safeDivide(forwardLoadedDistance, technicalSpeed) + serviceTime;
      const canPerformExtraTrip = deltaTime >= requiredTimeForExtraTrip && technicalSpeed > 0;

      const totalCycles = fullCycles + (canPerformExtraTrip ? 0.5 : 0);
      const baseTrips = fullCycles * 2;
      const totalTrips = baseTrips + (canPerformExtraTrip ? 1 : 0);
      const tripsForward = fullCycles + (canPerformExtraTrip ? 1 : 0);
      const tripsReturn = fullCycles;

      const totalTonnage = tonnageFirstTrip * tripsForward + tonnageSecondTrip * tripsReturn;
      const tonKilometres = tonKmFirstTrip * tripsForward + tonKmSecondTrip * tripsReturn;

      const totalDistance =
        zeroRun1 +
        fullCycles * routeLength +
        (canPerformExtraTrip ? forwardLoadedDistance : 0) +
        (canPerformExtraTrip ? zeroRun2 : zeroRun1);

      const actualShiftTime =
        safeDivide(totalDistance, technicalSpeed) + serviceTime * totalTrips;

      const betaDay = safeDivide(
        forwardLoadedDistance * tripsForward + returnLoadedDistance * tripsReturn,
        totalDistance,
      );

      return {
        'Длина маршрута (lₘ = l_g₁ + l_g₂), км': formatNumber(routeLength),
        'Время первой ездки (tₑ₁), ч': formatNumber(firstTripTime),
        'Время второй ездки (tₑ₂), ч': formatNumber(secondTripTime),
        'Время оборота (tₒ), ч': formatNumber(cycleTime),
        'Выработка в тоннах первой ездки (Qₑ₁), т': formatNumber(tonnageFirstTrip),
        'Выработка в тоннах второй ездки (Qₑ₂), т': formatNumber(tonnageSecondTrip),
        'Выработка в тоннах за оборот (Qₒ), т': formatNumber(tonnagePerCycle),
        'Тонно-километры первой ездки (Pₑ₁), ткм': formatNumber(tonKmFirstTrip),
        'Тонно-километры второй ездки (Pₑ₂), ткм': formatNumber(tonKmSecondTrip),
        'Тонно-километры за оборот (Pₒ), ткм': formatNumber(tonKmPerCycle),
        'Теоретическое число оборотов (Zₒ = Tₙ / tₒ)': formatNumber(theoreticalCycles, 2),
        'Фактическое число оборотов (Zₒ факт), шт': formatNumber(totalCycles, 2),
        'Целое число оборотов [Tₙ / tₒ], шт': fullCycles,
        'Число ездок без проверки (Zₑ), шт': baseTrips,
        'Остаток времени после целых оборотов (ΔTₙ), ч': formatNumber(deltaTime),
        'Необходимое время для дополнительной ездки (tₑₙ), ч': formatNumber(requiredTimeForExtraTrip),
        'Возможность дополнительной ездки': canPerformExtraTrip ? 'выполнима' : 'не выполнима',
        'Число ездок с учётом проверки (Zₑ факт), шт': totalTrips,
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
  },
  {
    id: 'ring-route',
    name: '2.2. Кольцевой маршрут',
    description:
      'Методика 2.2 рассчитывает показатели работы автомобиля на кольцевом маршруте с двумя гружёными и двумя холостыми участками.',
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
      {
        name: 'serviceTime',
        label: 'Время на погрузку-выгрузку (tₚᵥ₁ = tₚᵥ₂), ч',
        min: 0,
        step: 0.1,
      },
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

      const gamma1 = staticLoadFactor;
      const gamma2 = staticLoadFactor;

      const routeLength = loadedDistance1 + emptyRun1 + loadedDistance2 + emptyRun2;

      const firstTripTravelTime = safeDivide(loadedDistance1 + emptyRun1, technicalSpeed);
      const secondTripTravelTime = safeDivide(loadedDistance2 + emptyRun2, technicalSpeed);
      const firstTripTime = firstTripTravelTime + serviceTime;
      const secondTripTime = secondTripTravelTime + serviceTime;
      const cycleTime = firstTripTime + secondTripTime;

      const tonnageFirstTrip = payloadCapacity * gamma1;
      const tonnageSecondTrip = payloadCapacity * gamma2;
      const tonnagePerCycle = tonnageFirstTrip + tonnageSecondTrip;

      const tonKmFirstTrip = payloadCapacity * gamma1 * loadedDistance1;
      const tonKmSecondTrip = payloadCapacity * gamma2 * loadedDistance2;
      const tonKmPerCycle = tonKmFirstTrip + tonKmSecondTrip;

      const theoreticalCycles = safeDivide(shiftDuration, cycleTime);
      const fullCycles = Math.floor(theoreticalCycles);
      const deltaTime = shiftDuration - fullCycles * cycleTime;
      const baseTrips = fullCycles * 2;

      const requiredTimeSecondTrip = safeDivide(loadedDistance2, technicalSpeed) + serviceTime;
      const canPerformExtraSecondTrip = technicalSpeed > 0 && deltaTime >= requiredTimeSecondTrip;

      const totalCycles = fullCycles + (canPerformExtraSecondTrip ? 0.5 : 0);
      const tripsFirst = fullCycles;
      const tripsSecond = fullCycles + (canPerformExtraSecondTrip ? 1 : 0);
      const totalTrips = tripsFirst + tripsSecond;

      const totalTonnage =
        payloadCapacity * gamma1 * tripsFirst + payloadCapacity * gamma2 * tripsSecond;
      const tonKilometres =
        payloadCapacity * gamma1 * tripsFirst * loadedDistance1 +
        payloadCapacity * gamma2 * tripsSecond * loadedDistance2;

      const distanceBase = zeroRun1 + routeLength * totalCycles;
      const totalDistanceRaw = Number.isInteger(totalCycles)
        ? distanceBase + zeroRun3 - emptyRun2
        : distanceBase + zeroRun2 - emptyRun1;
      const totalDistance = Math.max(totalDistanceRaw, 0);

      const actualShiftTime =
        safeDivide(totalDistance, technicalSpeed) + serviceTime * totalTrips;

      const betaTrip1 = safeDivide(loadedDistance1, loadedDistance1 + emptyRun1);
      const betaTrip2 = safeDivide(loadedDistance2, loadedDistance2 + emptyRun2);
      const betaCycle = safeDivide(loadedDistance1 + loadedDistance2, routeLength);
      const betaDay = safeDivide(
        loadedDistance1 * tripsFirst + loadedDistance2 * tripsSecond,
        totalDistance,
      );

      return {
        'Длина маршрута (lₘ = l_g₁ + lₓ₁ + l_g₂ + lₓ₂), км': formatNumber(routeLength),
        'Время первой ездки (tₑ₁), ч': formatNumber(firstTripTime),
        'Время второй ездки (tₑ₂), ч': formatNumber(secondTripTime),
        'Время оборота (tₒ), ч': formatNumber(cycleTime),
        'Выработка в тоннах первой ездки (Qₑ₁), т': formatNumber(tonnageFirstTrip),
        'Выработка в тоннах второй ездки (Qₑ₂), т': formatNumber(tonnageSecondTrip),
        'Выработка в тоннах за оборот (Qₒ), т': formatNumber(tonnagePerCycle),
        'Тонно-километры первой ездки (Pₑ₁), ткм': formatNumber(tonKmFirstTrip),
        'Тонно-километры второй ездки (Pₑ₂), ткм': formatNumber(tonKmSecondTrip),
        'Тонно-километры за оборот (Pₒ), ткм': formatNumber(tonKmPerCycle),
        'Теоретическое число оборотов (Zₒ = Tₙ / tₒ)': formatNumber(theoreticalCycles, 2),
        'Целое число оборотов [Tₙ / tₒ], шт': fullCycles,
        'Фактическое число оборотов (Zₒ факт), шт': formatNumber(totalCycles, 2),
        'Число ездок без проверки (Zₑ), шт': baseTrips,
        'Остаток времени после целых оборотов (ΔTₙ), ч': formatNumber(deltaTime),
        'Необходимое время второй ездки (tₑₙ₂), ч': formatNumber(requiredTimeSecondTrip),
        'Решение о дополнительной ездке': canPerformExtraSecondTrip ? 'выполнима' : 'не выполнима',
        'Число ездок с учётом проверки (Zₑ факт), шт': totalTrips,
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
  },
];

export { methods };
