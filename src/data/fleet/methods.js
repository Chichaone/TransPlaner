import { formatNumber, safeDivide, toNumber } from '../../utils.js';

const fleetMethods = [
  {
    id: 'fleet-pendulum-empty-return',
    name:
      'Методика расчета показателей работы группы автомобилей на маятниковом маршруте с обратным не груженым пробегом',
    mode: 'fleet',
    description:
      'Расчёт показателей работы группы автомобилей на маятниковом маршруте с обратным не груженым пробегом.',
    inputs: [
      { name: 'payload', label: 'Грузоподъёмность автомобиля, т (q)', min: 0, step: 0.1 },
      {
        name: 'loadFactor',
        label: 'Коэффициент использования грузоподъёмности (γ)',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.9,
      },
      { name: 'dutyTime', label: 'Время в наряде, ч (Tн)', min: 0, step: 0.1, defaultValue: 10 },
      { name: 'loadUnloadTime', label: 'Время на погрузку и выгрузку, ч (tпв)', min: 0, step: 0.01, defaultValue: 0.2 },
      {
        name: 'singleOperationTime',
        label: 'Время одной операции (погрузка или выгрузка), ч (tп)',
        min: 0,
        step: 0.01,
        defaultValue: 0.1,
      },
      { name: 'loadedDistance', label: 'Гружёный пробег, км (lг)', min: 0, step: 0.1, defaultValue: 16 },
      { name: 'zeroRun1', label: 'Первый нулевой пробег, км (lн1)', min: 0, step: 0.1, defaultValue: 7 },
      { name: 'zeroRun2', label: 'Второй нулевой пробег, км (lн2)', min: 0, step: 0.1, defaultValue: 11 },
      { name: 'emptyDistance', label: 'Холостой пробег, км (lх)', min: 0, step: 0.1, defaultValue: 16 },
      { name: 'technicalSpeed', label: 'Среднетехническая скорость, км/ч (Vт)', min: 0, step: 0.1, defaultValue: 25 },
    ],
    calculate: (values) => {
      const payload = toNumber(values.payload);
      const loadFactor = toNumber(values.loadFactor);
      const dutyTime = toNumber(values.dutyTime);
      const loadUnloadTime = toNumber(values.loadUnloadTime);
      const singleOperationTime = toNumber(values.singleOperationTime);
      const loadedDistance = toNumber(values.loadedDistance);
      const zeroRun1 = toNumber(values.zeroRun1);
      const zeroRun2 = toNumber(values.zeroRun2);
      const emptyDistance = toNumber(values.emptyDistance);
      const technicalSpeed = toNumber(values.technicalSpeed);

      const routeLength = loadedDistance + emptyDistance; // lм
      const tripDriveTime = safeDivide(routeLength, technicalSpeed);
      const tripTime = tripDriveTime + loadUnloadTime; // tₑₒ
      const payloadPerTrip = payload * loadFactor; // Qₑₒ
      const tonneKmPerTrip = payloadPerTrip * loadedDistance; // Pₑₒ

      const operationTime =
        singleOperationTime || (loadUnloadTime > 0 ? loadUnloadTime / 2 : 0); // Rₘₐₓ
      const throughputRaw = operationTime > 0 ? safeDivide(tripTime, operationTime) : 0; // Аэ′
      const throughput = Math.max(Math.floor(throughputRaw), 1); // Аэ

      const perVehicle = [];
      let tonnageSum = 0;
      let tonneKmSum = 0;
      let distanceSum = 0;
      let actualDutySum = 0;

      const essentialTripTime = safeDivide(loadedDistance, technicalSpeed) + loadUnloadTime; // tен

      for (let i = 1; i <= throughput; i += 1) {
        const availableTime = dutyTime - operationTime * (i - 1); // Tмᵢ
        const boundedTime = Math.max(availableTime, 0);
        const baseTripsRaw = safeDivide(boundedTime, tripTime); // Tмᵢ / tₑₒ
        const baseTrips = Math.floor(baseTripsRaw); // [Tмᵢ / tₑₒ]
        const remainderTime = boundedTime - baseTrips * tripTime; // ΔTнᵢ
        const trips = remainderTime >= essentialTripTime ? Math.ceil(baseTripsRaw) : baseTrips; // Zₑᵢ

        const tonnage = payloadPerTrip * trips; // Qнᵢ
        const tonneKm = tonneKmPerTrip * trips; // Pнᵢ
        const totalDistance = zeroRun1 + routeLength * trips + zeroRun2 - emptyDistance; // Lобщᵢ
        const actualDutyTime = safeDivide(totalDistance, technicalSpeed) + trips * loadUnloadTime; // Tнi факт

        tonnageSum += tonnage;
        tonneKmSum += tonneKm;
        distanceSum += totalDistance;
        actualDutySum += actualDutyTime;

        perVehicle.push({ trips, tonnage, tonneKm, totalDistance, actualDutyTime });
      }

      const perVehicleRows = perVehicle.map((item, index) => ({
        index: index + 1,
        trips: formatNumber(item.trips),
        tonnage: formatNumber(item.tonnage),
        tonneKm: formatNumber(item.tonneKm),
        totalDistance: formatNumber(item.totalDistance),
        actualDutyTime: formatNumber(item.actualDutyTime),
      }));

      return {
        'Длина маршрута lм, км': formatNumber(routeLength),
        'Время ездки tₑₒ, ч': formatNumber(tripTime),
        'Пропускная способность Аэ′ (неокруглённо), авто': formatNumber(throughputRaw, 2),
        'Принятое количество авто Аэ (округлено вниз), авто': throughput,
        'Выработка за ездку Qₑₒ, т': formatNumber(payloadPerTrip),
        'Тонно-километры за ездку Pₑₒ, ткм': formatNumber(tonneKmPerTrip),
        'Показатели по автомобилям': {
          type: 'table',
          headers: [
            'i',
            'Число ездок Zₑᵢ, шт',
            'Выработка Qнᵢ, т',
            'Тонно-километры Pнᵢ, ткм',
            'Общий пробег Lобщᵢ, км',
            'Фактическое время в наряде Tнᵢ факт, ч',
          ],
          rows: perVehicleRows,
        },
        'Суммарная выработка Qн = Σ Qᵢ, т': formatNumber(tonnageSum),
        'Суммарные тонно-километры Pн = Σ Pᵢ, ткм': formatNumber(tonneKmSum),
        'Суммарный пробег Lобщ = Σ Lобщᵢ, км': formatNumber(distanceSum),
        'Суммарное фактическое время Tн факт = Σ Tн фактᵢ, ч': formatNumber(actualDutySum),
      };
    },
  },
  {
    id: 'fleet-pendulum-partial-loaded-return',
    name:
      'Методика расчета показателей работы группы автомобилей на маятниковом маршруте с обратным гружёным пробегом не на всем расстоянии перевозок (γ₁ = γ₂)',
    mode: 'fleet',
    description:
      'Оценивает работу группы на маятниковом маршруте с частично гружёным обратным пробегом при равных коэффициентах загрузки.',
    inputs: [
      { name: 'payload', label: 'Грузоподъёмность автомобиля, т (q)', min: 0, step: 0.1, defaultValue: 10 },
      { name: 'dutyTime', label: 'Плановое время в наряде, ч (Tн)', min: 0, step: 0.1, defaultValue: 10 },
      { name: 'loadUnloadTime', label: 'Время на погрузку‑выгрузку, ч (tпв)', min: 0, step: 0.01, defaultValue: 0.4 },
      { name: 'loadedDistance1', label: 'Расстояние перевозки в прямом направлении, км (lг₁)', min: 0, step: 0.1, defaultValue: 16 },
      {
        name: 'loadedDistance2',
        label: 'Гружёный участок обратного направления, км (lг₂)',
        min: 0,
        step: 0.1,
        defaultValue: 10,
      },
      { name: 'zeroRun1', label: 'Первый нулевой пробег, км (lн₁)', min: 0, step: 0.1, defaultValue: 13 },
      { name: 'zeroRun2', label: 'Второй нулевой пробег, км (lн₂)', min: 0, step: 0.1, defaultValue: 8 },
      { name: 'zeroRun3', label: 'Третий нулевой пробег, км (lн₃)', min: 0, step: 0.1, defaultValue: 6 },
      { name: 'emptyDistance2', label: 'Холостой пробег, км (lх₂)', min: 0, step: 0.1, defaultValue: 5 },
      { name: 'technicalSpeed', label: 'Среднетехническая скорость, км/ч (Vт)', min: 0, step: 0.1, defaultValue: 25 },
      { name: 'loadFactor', label: 'Коэффициент использования грузоподъёмности (γ)', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    ],
    calculate: (values) => {
      const payload = toNumber(values.payload);
      const dutyTime = toNumber(values.dutyTime);
      const loadUnloadTime = toNumber(values.loadUnloadTime);
      const loadedDistance1 = toNumber(values.loadedDistance1);
      const loadedDistance2 = toNumber(values.loadedDistance2);
      const zeroRun1 = toNumber(values.zeroRun1);
      const zeroRun2 = toNumber(values.zeroRun2);
      const zeroRun3 = toNumber(values.zeroRun3);
      const emptyDistance2 = toNumber(values.emptyDistance2);
      const technicalSpeed = toNumber(values.technicalSpeed);
      const loadFactor = toNumber(values.loadFactor);

      const operationTime = loadUnloadTime / 2; // tп = tв = 0,5·tпв
      const routeLength = loadedDistance1 + loadedDistance2 + emptyDistance2; // lм
      const tripTime1 = safeDivide(loadedDistance1, technicalSpeed) + loadUnloadTime; // tе₁
      const tripTime2 = safeDivide(loadedDistance2 + emptyDistance2, technicalSpeed) + loadUnloadTime; // tе₂
      const turnaroundTime = tripTime1 + tripTime2; // tо
      const avgTripTime = safeDivide(turnaroundTime, 2); // tеср (Zе = 2)

      const payloadPerTrip = payload * loadFactor; // Qе = q·γ
      const tonnagePerTurn = payloadPerTrip * 2; // Qо

      const tonneKmTrip1 = payloadPerTrip * loadedDistance1; // Pе₁
      const tonneKmTrip2 = payloadPerTrip * loadedDistance2; // Pе₂
      const tonneKmPerTurn = tonneKmTrip1 + tonneKmTrip2; // Pо = qγ·lг₁ + qγ·lг₂

      const throughputSingleRaw = operationTime > 0 ? safeDivide(turnaroundTime, operationTime) : 0; // Aэ′ вариант 1
      const throughputSingle = Math.max(Math.floor(throughputSingleRaw), 1);
      const throughputDualRaw = operationTime > 0 ? safeDivide(avgTripTime, operationTime) : 0; // Aэ′ вариант 2
      const throughputDualGroups = Math.max(Math.floor(throughputDualRaw), 1);

      const essentialTripTime = safeDivide(loadedDistance2, technicalSpeed) + loadUnloadTime; // tен
      const tripsPerTurn = 2; // Zе

      const perGroup = [];
      const perVehicle = [];
      let tonnageSum = 0;
      let tonneKmSum = 0;
      let distanceSum = 0;
      let dutySum = 0;

      for (let j = 1; j <= throughputDualGroups; j += 1) {
        const availableTime = dutyTime - operationTime * (j - 1); // Tмj
        const boundedTime = Math.max(availableTime, 0);
        const rawTurnovers = safeDivide(boundedTime, turnaroundTime); // Tмj / tо
        const intTurnovers = Math.floor(rawTurnovers); // Zоj = INT(Tмj/tо)
        const remainder = boundedTime - intTurnovers * turnaroundTime; // ΔTнj

        const baseTrips = intTurnovers * tripsPerTurn; // Zе (без проверки последней ездки)
        const extraTrip = remainder >= essentialTripTime ? 1 : 0; // проверка последнего оборота

        const tripsOnLeg1 = intTurnovers; // Zе1
        const tripsOnLeg2 = intTurnovers + extraTrip; // Zе2
        const totalTrips = baseTrips + extraTrip; // Zе

        const tonnage = payloadPerTrip * totalTrips; // Qнj
        const tonneKm = payloadPerTrip * (tripsOnLeg1 * loadedDistance1 + tripsOnLeg2 * loadedDistance2); // Pнj

        const startsAtP1 = j % 2 !== 0; // чередуем П1 и П2
        const isWholeTurn = Math.abs(rawTurnovers - intTurnovers) < 1e-9;
        let totalDistance;

        if (startsAtP1) {
          totalDistance = isWholeTurn
            ? zeroRun1 + routeLength * intTurnovers + zeroRun3 - emptyDistance2
            : zeroRun1 + routeLength * intTurnovers + zeroRun2; // Lобщj (П1)
        } else {
          totalDistance = isWholeTurn
            ? zeroRun2 + routeLength * intTurnovers + zeroRun2
            : zeroRun2 + routeLength * intTurnovers + zeroRun3 - emptyDistance2; // Lобщj (П2)
        }

        const actualDuty = safeDivide(totalDistance, technicalSpeed) + totalTrips * loadUnloadTime; // Tнj факт

        perGroup.push({
          index: j,
          availableTime,
          intTurnovers,
          remainder,
          tripsOnLeg1,
          tripsOnLeg2,
          totalTrips,
          tonnage,
          tonneKm,
        });

        tonnageSum += tonnage;
        tonneKmSum += tonneKm;
        distanceSum += totalDistance;
        dutySum += actualDuty;

        const vehicleIndexBase = (j - 1) * 2;
        for (let k = 0; k < 2; k += 1) {
          perVehicle.push({
            index: vehicleIndexBase + k + 1,
            trips: totalTrips,
            tonnage,
            tonneKm,
            totalDistance,
            actualDutyTime: actualDuty,
          });
        }
      }

      const perGroupRows = perGroup.map((item) => ({
        index: item.index,
        availableTime: formatNumber(item.availableTime),
        intTurnovers: formatNumber(item.intTurnovers),
        remainder: formatNumber(item.remainder),
        tripsOnLeg1: formatNumber(item.tripsOnLeg1),
        tripsOnLeg2: formatNumber(item.tripsOnLeg2),
        totalTrips: formatNumber(item.totalTrips),
        tonnage: formatNumber(item.tonnage),
        tonneKm: formatNumber(item.tonneKm),
      }));

      const perVehicleRows = perVehicle.map((item) => ({
        index: item.index,
        trips: formatNumber(item.trips),
        tonnage: formatNumber(item.tonnage),
        tonneKm: formatNumber(item.tonneKm),
        totalDistance: formatNumber(item.totalDistance),
        actualDutyTime: formatNumber(item.actualDutyTime),
      }));

      return {
        'Длина маршрута lм, км': formatNumber(routeLength),
        'Время первой ездки tе₁, ч': formatNumber(tripTime1),
        'Время второй ездки tе₂, ч': formatNumber(tripTime2),
        'Время оборота tо, ч': formatNumber(turnaroundTime),
        'Среднее время ездки tеср, ч': formatNumber(avgTripTime),
        'Выработка за ездку Qе, т': formatNumber(payloadPerTrip),
        'Выработка за оборот Qо, т': formatNumber(tonnagePerTurn),
        'Тонно-километры за первую ездку Pе₁, ткм': formatNumber(tonneKmTrip1),
        'Тонно-километры за вторую ездку Pе₂, ткм': formatNumber(tonneKmTrip2),
        'Тонно-километры за оборот Pо, ткм': formatNumber(tonneKmPerTurn),
        'Пропускная способность Aэ′ (один пункт), авто': formatNumber(throughputSingleRaw),
        'Принятое количество авто Aэ (один пункт), авто': throughputSingle,
        'Пропускная способность Aэ′ (два пункта), группы': formatNumber(throughputDualRaw),
        'Принятое число групп Aэ (два пункта), группы': throughputDualGroups,
        'Расчёт для подачи в два пункта (j группы)': {
          type: 'table',
          headers: ['j', 'Tмj, ч', 'Zоj = INT(Tмj/tо)', 'ΔTнj, ч', 'Zе₁', 'Zе₂', 'Zе', 'Qнj, т', 'Pнj, ткм'],
          rows: perGroupRows,
        },
        'Показатели по автомобилям': {
          type: 'table',
          headers: [
            'i',
            'Число ездок Zₑᵢ, шт',
            'Выработка Qнᵢ, т',
            'Тонно-километры Pнᵢ, ткм',
            'Общий пробег Lобщᵢ, км',
            'Фактическое время в наряде Tнᵢ факт, ч',
          ],
          rows: perVehicleRows,
        },
        'Суммарная выработка Qн = Σ Qᵢ, т': formatNumber(tonnageSum),
        'Суммарные тонно-километры Pн = Σ Pᵢ, ткм': formatNumber(tonneKmSum),
        'Суммарный пробег Lобщ = Σ Lобщᵢ, км': formatNumber(distanceSum),
        'Суммарное фактическое время Tн факт = Σ Tн фактᵢ, ч': formatNumber(dutySum),
      };
    },
  },
  {
    id: 'fleet-shift-balance',
    name: 'Групповое сменное задание',
    mode: 'fleet',
    description: 'Рассчитывает суммарные показатели группы автомобилей по средним параметрам смены.',
    inputs: [
      { name: 'vehicles', label: 'Количество автомобилей в группе, шт', min: 1, step: 1 },
      { name: 'avgTrips', label: 'Среднее число ездок на автомобиль, шт', min: 0, step: 0.1 },
      { name: 'avgPayload', label: 'Средняя масса груза за ездку, т', min: 0, step: 0.1 },
      { name: 'routeLength', label: 'Длина маршрута, км', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const vehicles = toNumber(values.vehicles);
      const avgTrips = toNumber(values.avgTrips);
      const avgPayload = toNumber(values.avgPayload);
      const routeLength = toNumber(values.routeLength);

      const totalTrips = vehicles * avgTrips;
      const totalPayload = totalTrips * avgPayload;
      const totalDistance = totalTrips * routeLength;

      return {
        'Всего ездок за смену, шт': formatNumber(totalTrips, 1),
        'Общий объём перевозок, т': formatNumber(totalPayload),
        'Суммарный пробег группы, км': formatNumber(totalDistance),
      };
    },
  },
  {
    id: 'fleet-utilization',
    name: 'Использование парка по времени',
    mode: 'fleet',
    description: 'Оценка использования сменного фонда автомобилей с учётом простоев и подготовительного времени.',
    inputs: [
      { name: 'vehicles', label: 'Автомобилей в парке, шт', min: 1, step: 1 },
      { name: 'shiftDuration', label: 'Длительность смены, ч', min: 0, step: 0.1 },
      { name: 'prepTime', label: 'Подготовительно-заключительное время, ч', min: 0, step: 0.1 },
      { name: 'downtime', label: 'Плановые простои, ч', min: 0, step: 0.1 },
      { name: 'workingTime', label: 'Фактическое время работы, ч', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const vehicles = toNumber(values.vehicles);
      const shiftDuration = toNumber(values.shiftDuration);
      const prepTime = toNumber(values.prepTime);
      const downtime = toNumber(values.downtime);
      const workingTime = toNumber(values.workingTime);

      const effectiveTime = Math.max(shiftDuration - prepTime - downtime, 0);
      const utilization = safeDivide(workingTime, shiftDuration);
      const readiness = safeDivide(effectiveTime, shiftDuration);
      const vehicleHours = workingTime * vehicles;

      return {
        'Эффективное сменное время, ч': formatNumber(effectiveTime),
        'Готовность парка (доля)': formatNumber(readiness, 3),
        'Коэффициент использования времени': formatNumber(utilization, 3),
        'Время работы всего парка, чел·ч': formatNumber(vehicleHours),
      };
    },
  },
  {
    id: 'fleet-multi-route',
    name: 'Групповая работа на нескольких плечах',
    mode: 'fleet',
    description: 'Балансирует объём перевозок между двумя плечами для одной группы автомобилей.',
    inputs: [
      { name: 'vehicles', label: 'Число автомобилей, шт', min: 1, step: 1 },
      { name: 'payloadA', label: 'Средний груз на плече A, т', min: 0, step: 0.1 },
      { name: 'payloadB', label: 'Средний груз на плече B, т', min: 0, step: 0.1 },
      { name: 'distanceA', label: 'Длина плеча A, км', min: 0, step: 0.1 },
      { name: 'distanceB', label: 'Длина плеча B, км', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const vehicles = toNumber(values.vehicles);
      const payloadA = toNumber(values.payloadA);
      const payloadB = toNumber(values.payloadB);
      const distanceA = toNumber(values.distanceA);
      const distanceB = toNumber(values.distanceB);

      const averagePayload = safeDivide(payloadA + payloadB, 2);
      const weightedDistance = safeDivide(distanceA * payloadA + distanceB * payloadB, payloadA + payloadB);
      const totalPayload = vehicles * averagePayload;

      return {
        'Средняя загрузка на ездку, т': formatNumber(averagePayload),
        'Условная длина плеча, км': formatNumber(weightedDistance),
        'Суточный объём перевозок, т': formatNumber(totalPayload),
      };
    },
  },
  {
    id: 'fleet-time-balance',
    name: 'Баланс времени группы',
    mode: 'fleet',
    description: 'Определяет структуру использования времени по типам операций для автоколонны.',
    inputs: [
      { name: 'vehicles', label: 'Количество машин, шт', min: 1, step: 1 },
      { name: 'drivingTime', label: 'Время в движении, ч', min: 0, step: 0.1 },
      { name: 'serviceTime', label: 'Время погрузки/разгрузки, ч', min: 0, step: 0.1 },
      { name: 'idleTime', label: 'Простой организационный, ч', min: 0, step: 0.1 },
    ],
    calculate: (values) => {
      const vehicles = toNumber(values.vehicles);
      const drivingTime = toNumber(values.drivingTime);
      const serviceTime = toNumber(values.serviceTime);
      const idleTime = toNumber(values.idleTime);

      const totalTime = drivingTime + serviceTime + idleTime;
      const drivingShare = safeDivide(drivingTime, totalTime);
      const serviceShare = safeDivide(serviceTime, totalTime);
      const idleShare = safeDivide(idleTime, totalTime);
      const vehicleHours = totalTime * vehicles;

      return {
        'Суммарное время, ч': formatNumber(totalTime),
        'В движении, доля смены': formatNumber(drivingShare, 3),
        'На обслуживании, доля смены': formatNumber(serviceShare, 3),
        'Простой, доля смены': formatNumber(idleShare, 3),
        'Затраты времени группы, чел·ч': formatNumber(vehicleHours),
      };
    },
  },
  {
    id: 'fleet-capacity',
    name: 'Пропускная способность автоколонны',
    mode: 'fleet',
    description: 'Оценивает потенциальный суточный объём перевозок группы при заданной грузоподъёмности.',
    inputs: [
      { name: 'vehicles', label: 'Количество машин, шт', min: 1, step: 1 },
      { name: 'payloadCapacity', label: 'Грузоподъёмность одной машины, т', min: 0, step: 0.1 },
      { name: 'turnaroundTime', label: 'Время оборота, ч', min: 0, step: 0.1 },
      { name: 'shiftDuration', label: 'Длительность смены, ч', min: 0, step: 0.1 },
      { name: 'loadFactor', label: 'Коэффициент использования грузоподъёмности', min: 0, max: 1, step: 0.01 },
    ],
    calculate: (values) => {
      const vehicles = toNumber(values.vehicles);
      const payloadCapacity = toNumber(values.payloadCapacity);
      const turnaroundTime = toNumber(values.turnaroundTime);
      const shiftDuration = toNumber(values.shiftDuration);
      const loadFactor = toNumber(values.loadFactor);

      const tripsPerVehicle = Math.floor(safeDivide(shiftDuration, turnaroundTime));
      const totalTrips = tripsPerVehicle * vehicles;
      const payloadPerTrip = payloadCapacity * loadFactor;
      const totalPayload = payloadPerTrip * totalTrips;

      return {
        'Ездок на машину за смену, шт': tripsPerVehicle,
        'Всего ездок за смену, шт': totalTrips,
        'Загрузка на ездку, т': formatNumber(payloadPerTrip),
        'Сменный объём перевозок, т': formatNumber(totalPayload),
      };
    },
  },
];

export { fleetMethods };
