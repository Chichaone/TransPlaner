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
    id: 'pendulum-empty',
    name: '2.1.1. Маятниковый маршрут с обратным порожним пробегом',
    description:
      'Прямое плечо выполняется с грузом, обратное — порожняком. Введите параметры для расчёта сменных показателей работы автомобиля.',
    inputs: [
      { name: 'distance', label: 'Расстояние между пунктами (lₙ), км', min: 0, step: 0.1 },
      { name: 'loadedSpeed', label: 'Средняя скорость в гружёном направлении (Vₜ), км/ч', min: 0, step: 0.1 },
      { name: 'emptySpeed', label: 'Средняя скорость в обратном (порожнем) направлении (Vₒ), км/ч', min: 0, step: 0.1 },
      { name: 'loadingTime', label: 'Время погрузки (tₚ), ч', min: 0, step: 0.1 },
      { name: 'unloadingTime', label: 'Время разгрузки (tᵣ), ч', min: 0, step: 0.1 },
      { name: 'prepTime', label: 'Подготовительно-заключительное время (tₚ₋ₓ), ч', min: 0, step: 0.1 },
      { name: 'shiftDuration', label: 'Продолжительность смены (Tₙ), ч', min: 0, step: 0.1 },
      { name: 'payloadForward', label: 'Масса груза на прямой ездке (q₁), т', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const distance = toNumber(values.distance);
      const loadedSpeed = toNumber(values.loadedSpeed);
      const emptySpeed = toNumber(values.emptySpeed);
      const loadingTime = toNumber(values.loadingTime);
      const unloadingTime = toNumber(values.unloadingTime);
      const prepTime = toNumber(values.prepTime);
      const shiftDuration = toNumber(values.shiftDuration);
      const payloadForward = toNumber(values.payloadForward);

      const routeLength = 2 * distance;
      const loadedTripTime = distance / loadedSpeed;
      const emptyTripTime = distance / emptySpeed;
      const drivingTime = loadedTripTime + emptyTripTime;
      const serviceTime = loadingTime + unloadingTime;

      const segments = [
        { distance, speed: loadedSpeed, loadFactor: 1 },
        { distance, speed: emptySpeed, loadFactor: 0 },
      ];

      const payloads = [payloadForward, 0];

      const metrics = computeCycleMetrics({
        segments,
        serviceTime,
        shiftDuration,
        prepTime,
        payloads,
      });

      return {
        'Длина маршрута (lₘ), км': formatNumber(routeLength),
        'Время гружёной ездки (tₙ), ч': formatNumber(loadedTripTime),
        'Время порожней ездки (tₒ), ч': formatNumber(emptyTripTime),
        'Время движения за оборот, ч': formatNumber(drivingTime),
        'Простои под погрузкой/разгрузкой за оборот, ч': formatNumber(serviceTime),
        'Полное время оборота (tₒб), ч': formatNumber(drivingTime + serviceTime),
        'Эффективное сменное время, ч': formatNumber(metrics.effectiveShift),
        'Выполнимое число ездок (Zₑ), шт': metrics.trips,
        'Остаток сменного времени (ΔTₙ), ч': formatNumber(metrics.remainingTime),
        'Общий пробег за смену (Lₒбщ), км': formatNumber(metrics.totalDistance),
        'Выработка в тоннах за смену (Qₛ), т': formatNumber(metrics.totalTonnage),
        'Тонно-километровая работа (Wₜ), ткм': formatNumber(metrics.tonKilometres),
        'Фактическое время в наряде (Tₙ факт), ч': formatNumber(metrics.actualShiftTime),
        'Коэффициент использования пробега за ездку (βₑ,ₒ)': formatNumber(metrics.betaTrip, 3),
        'Коэффициент использования пробега за день (βд)': formatNumber(metrics.betaDay, 3),
      };
    },
  },
  {
    id: 'pendulum-partial-return',
    name: '2.1.2. Маятниковый маршрут с частично гружёным обратным пробегом (γ₁ = γ₂)',
    description:
      'Обратное плечо выполняется частично с грузом. Коэффициенты использования грузоподъёмности совпадают для обоих направлений.',
    inputs: [
      { name: 'distance', label: 'Расстояние между пунктами (lₙ), км', min: 0, step: 0.1 },
      { name: 'loadedSpeedForward', label: 'Скорость в прямом гружёном направлении (Vₜ₁), км/ч', min: 0, step: 0.1 },
      { name: 'loadedSpeedReturn', label: 'Скорость на гружёном участке обратной ездки (Vₜ₂), км/ч', min: 0, step: 0.1 },
      { name: 'emptySpeedReturn', label: 'Скорость на порожнем участке обратной ездки (Vₒ), км/ч', min: 0, step: 0.1 },
      { name: 'loadedReturnDistance', label: 'Длина гружёного участка обратного хода (lᵣₗ), км', min: 0, step: 0.1 },
      { name: 'loadingTime', label: 'Время погрузки (tₚ), ч', min: 0, step: 0.1 },
      { name: 'unloadingTimeForward', label: 'Время разгрузки в пункте назначения (tᵣ₁), ч', min: 0, step: 0.1 },
      { name: 'unloadingTimeReturn', label: 'Время разгрузки на обратном пути (tᵣ₂), ч', min: 0, step: 0.1 },
      { name: 'prepTime', label: 'Подготовительно-заключительное время (tₚ₋ₓ), ч', min: 0, step: 0.1 },
      { name: 'shiftDuration', label: 'Продолжительность смены (Tₙ), ч', min: 0, step: 0.1 },
      { name: 'payload', label: 'Масса груза на каждой гружёной части (q), т', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const distance = toNumber(values.distance);
      const loadedSpeedForward = toNumber(values.loadedSpeedForward);
      const loadedSpeedReturn = toNumber(values.loadedSpeedReturn);
      const emptySpeedReturn = toNumber(values.emptySpeedReturn);
      const loadedReturnDistance = Math.min(toNumber(values.loadedReturnDistance), distance);
      const emptyReturnDistance = Math.max(distance - loadedReturnDistance, 0);
      const loadingTime = toNumber(values.loadingTime);
      const unloadingTimeForward = toNumber(values.unloadingTimeForward);
      const unloadingTimeReturn = toNumber(values.unloadingTimeReturn);
      const prepTime = toNumber(values.prepTime);
      const shiftDuration = toNumber(values.shiftDuration);
      const payload = toNumber(values.payload);

      const serviceTime = loadingTime + unloadingTimeForward + unloadingTimeReturn;

      const segments = [
        { distance, speed: loadedSpeedForward, loadFactor: 1 },
        { distance: loadedReturnDistance, speed: loadedSpeedReturn, loadFactor: 1 },
        { distance: emptyReturnDistance, speed: emptySpeedReturn, loadFactor: 0 },
      ];

      const payloads = [payload, payload, 0];

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
        'Гружёное плечо прямого хода, км': formatNumber(distance),
        'Гружёное плечо обратного хода, км': formatNumber(loadedReturnDistance),
        'Порожний участок обратной ездки, км': formatNumber(emptyReturnDistance),
        'Время гружёной ездки вперёд, ч': formatNumber(distance / loadedSpeedForward),
        'Время гружёной части обратной ездки, ч': formatNumber(loadedReturnDistance / loadedSpeedReturn),
        'Время порожней части обратной ездки, ч': formatNumber(safeDivide(emptyReturnDistance, emptySpeedReturn)),
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
      'В прямом и обратном направлениях используются разные коэффициенты использования грузоподъёмности. Задайте значения грузов и скоростей для каждого плеча.',
    inputs: [
      { name: 'distance', label: 'Расстояние между пунктами (lₙ), км', min: 0, step: 0.1 },
      { name: 'loadedSpeedForward', label: 'Скорость в прямом гружёном направлении (Vₜ₁), км/ч', min: 0, step: 0.1 },
      { name: 'loadedSpeedReturn', label: 'Скорость на гружёной части обратной ездки (Vₜ₂), км/ч', min: 0, step: 0.1 },
      { name: 'emptySpeedReturn', label: 'Скорость на порожней части обратной ездки (Vₒ), км/ч', min: 0, step: 0.1 },
      { name: 'loadedReturnDistance', label: 'Гружёная часть обратной ездки (lᵣₗ), км', min: 0, step: 0.1 },
      { name: 'loadingTime', label: 'Время погрузки (tₚ), ч', min: 0, step: 0.1 },
      { name: 'unloadingTimeForward', label: 'Время разгрузки в пункте назначения (tᵣ₁), ч', min: 0, step: 0.1 },
      { name: 'unloadingTimeReturn', label: 'Время разгрузки на обратном пути (tᵣ₂), ч', min: 0, step: 0.1 },
      { name: 'prepTime', label: 'Подготовительно-заключительное время (tₚ₋ₓ), ч', min: 0, step: 0.1 },
      { name: 'shiftDuration', label: 'Продолжительность смены (Tₙ), ч', min: 0, step: 0.1 },
      { name: 'payloadForward', label: 'Масса груза в прямом направлении (q₁), т', min: 0, step: 0.1 },
      { name: 'payloadReturn', label: 'Масса груза на гружёной части обратного направления (q₂), т', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const distance = toNumber(values.distance);
      const loadedSpeedForward = toNumber(values.loadedSpeedForward);
      const loadedSpeedReturn = toNumber(values.loadedSpeedReturn);
      const emptySpeedReturn = toNumber(values.emptySpeedReturn);
      const loadedReturnDistance = Math.min(toNumber(values.loadedReturnDistance), distance);
      const emptyReturnDistance = Math.max(distance - loadedReturnDistance, 0);
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
        { distance: loadedReturnDistance, speed: loadedSpeedReturn, loadFactor: 1 },
        { distance: emptyReturnDistance, speed: emptySpeedReturn, loadFactor: 0 },
      ];

      const payloads = [payloadForward, payloadReturn, 0];

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
        'Гружёное плечо прямого хода, км': formatNumber(distance),
        'Гружёная часть обратного хода, км': formatNumber(loadedReturnDistance),
        'Порожний участок обратного хода, км': formatNumber(emptyReturnDistance),
        'Время гружёной ездки вперёд, ч': formatNumber(distance / loadedSpeedForward),
        'Время гружёной части обратной ездки, ч': formatNumber(loadedReturnDistance / loadedSpeedReturn),
        'Время порожней части обратной ездки, ч': formatNumber(safeDivide(emptyReturnDistance, emptySpeedReturn)),
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
    id: 'ring-route',
    name: '2.2. Кольцевой маршрут',
    description:
      'Грузоперевозка по кольцевой схеме. Введите параметры каждого участка кольца и времена грузовых операций.',
    inputs: [
      { name: 'segmentCount', label: 'Число участков кольца (2-6)', min: 2, max: 6, step: 1, defaultValue: 4 },
      { name: 'shiftDuration', label: 'Продолжительность смены (Tₙ), ч', min: 0, step: 0.1 },
      { name: 'prepTime', label: 'Подготовительно-заключительное время (tₚ₋ₓ), ч', min: 0, step: 0.1 },
      { name: 'serviceTime', label: 'Суммарное время погрузочно-разгрузочных операций за оборот, ч', min: 0, step: 0.1 },
      { name: 'totalPayload', label: 'Суммарная масса перевезённого груза за оборот, т', min: 0, step: 0.1 },
      { name: 'segmentData', label: 'Параметры участков (через точку с запятой): дистанция км, скорость км/ч, масса груза т', placeholder: 'Напр.: 12,40,5; 18,38,4; 15,42,3; 10,45,2' },
    ],
    calculate: (values) => {
      const segmentCount = Math.min(
        Math.max(Math.round(toNumber(values.segmentCount) || 0), 2),
        6,
      );
      const shiftDuration = toNumber(values.shiftDuration);
      const prepTime = toNumber(values.prepTime);
      const serviceTime = toNumber(values.serviceTime);
      const totalPayload = toNumber(values.totalPayload);
      const segmentData = String(values.segmentData || '');

      const segmentsRaw = segmentData
        .split(';')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .slice(0, segmentCount);

      const segments = segmentsRaw.map((chunk) => {
        const [distanceRaw, speedRaw, payloadRaw] = chunk.split(',').map((item) => item.trim());
        const distance = toNumber(distanceRaw);
        const speed = toNumber(speedRaw);
        const payload = toNumber(payloadRaw);
        return {
          distance,
          speed,
          loadFactor: payload > 0 ? 1 : 0,
          payload,
        };
      });

      while (segments.length < segmentCount) {
        segments.push({ distance: 0, speed: 1, loadFactor: 0, payload: 0 });
      }

      const payloads = segments.map((segment) => segment.payload);
      const drivingTime = segments.reduce((acc, seg) => acc + safeDivide(seg.distance, seg.speed), 0);
      const cycleTime = drivingTime + serviceTime;
      const effectiveShift = Math.max(shiftDuration - prepTime, 0);
      const trips = Math.floor(effectiveShift / cycleTime);
      const remainingTime = effectiveShift - trips * cycleTime;
      const totalDistance = trips * segments.reduce((acc, seg) => acc + seg.distance, 0);
      const loadedDistance = trips * segments
        .filter((seg) => seg.loadFactor > 0)
        .reduce((acc, seg) => acc + seg.distance, 0);
      const tonKilometresPerCycle = segments.reduce(
        (acc, seg) => acc + seg.distance * seg.payload,
        0,
      );
      const totalTonKilometres = trips * tonKilometresPerCycle;
      const totalTonnage = trips * totalPayload;
      const actualShiftTime = prepTime + trips * cycleTime;
      const betaTrip = safeDivide(
        segments.filter((seg) => seg.payload > 0).reduce((acc, seg) => acc + seg.distance, 0),
        segments.reduce((acc, seg) => acc + seg.distance, 0),
      );
      const betaDay = safeDivide(loadedDistance, totalDistance);

      return {
        'Число участков кольца, шт': segmentCount,
        'Суммарный пробег за оборот, км': formatNumber(
          segments.reduce((acc, seg) => acc + seg.distance, 0),
        ),
        'Время движения за оборот, ч': formatNumber(drivingTime),
        'Полное время оборота (tₒб), ч': formatNumber(cycleTime),
        'Эффективное сменное время, ч': formatNumber(effectiveShift),
        'Выполнимое число оборотов (Zₒ), шт': trips,
        'Остаток сменного времени (ΔTₙ), ч': formatNumber(remainingTime),
        'Общий пробег за смену (Lₒбщ), км': formatNumber(totalDistance),
        'Выработка в тоннах за смену (Qₛ), т': formatNumber(totalTonnage),
        'Тонно-километровая работа (Wₜ), ткм': formatNumber(totalTonKilometres),
        'Фактическое время в наряде (Tₙ факт), ч': formatNumber(actualShiftTime),
        'Коэффициент использования пробега за оборот (βₑ,ₒ)': formatNumber(betaTrip, 3),
        'Коэффициент использования пробега за день (βд)': formatNumber(betaDay, 3),
      };
    },
  },
];

export { methods };
