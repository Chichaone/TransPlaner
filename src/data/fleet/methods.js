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
      const tonneKmPerTurn = tonneKmTrip1 + tonneKmTrip2; // Pо = Pе₁ + Pе₂

      const throughputSingleRaw = operationTime > 0 ? safeDivide(turnaroundTime, operationTime) : 0; // Aэ′ вариант 1
      const throughputSingle = Math.max(Math.floor(throughputSingleRaw), 1);
      const throughputDualRaw = operationTime > 0 ? safeDivide(avgTripTime, operationTime) : 0; // Aэ′ вариант 2
      const throughputDualGroups = Math.max(Math.floor(throughputDualRaw), 1);

      const essentialTripTime = safeDivide(loadedDistance2, technicalSpeed) + loadUnloadTime; // tен
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

        let tripsOnLeg1 = intTurnovers; // Zе1 = [Tмj / tо]
        let tripsOnLeg2 = intTurnovers; // Zе2 = [Tмj / tо]

        if (remainder >= essentialTripTime) {
          tripsOnLeg2 += 1; // дополнительная ездка на обратном плече
        }

        const totalTrips = tripsOnLeg1 + tripsOnLeg2; // Zе = Zе1 + Zе2

        const tonnage = payloadPerTrip * totalTrips; // Qнj
        const tonneKm = tonneKmTrip1 * tripsOnLeg1 + tonneKmTrip2 * tripsOnLeg2; // Pнj

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
          columns: ['index', 'availableTime', 'intTurnovers', 'remainder', 'tripsOnLeg1', 'tripsOnLeg2', 'totalTrips', 'tonnage', 'tonneKm'],
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
    id: 'fleet-pendulum-loaded-return',
    name:
      'Методика расчёта показателей работы группы автомобилей на маятниковом маршруте с обратным гружёным пробегом',
    mode: 'fleet',
    description:
      'Расчёт групповой работы на маятниковом маршруте с гружёным обратным пробегом и двумя вариантами подачи в пункты погрузки.',
    inputs: [
      { name: 'payload', label: 'Грузоподъёмность автомобиля, т (q)', min: 0, step: 0.1, defaultValue: 10 },
      {
        name: 'loadFactor',
        label: 'Коэффициент использования грузоподъёмности (γ)',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.9,
      },
      { name: 'dutyTime', label: 'Время в наряде, ч (Tн)', min: 0, step: 0.1, defaultValue: 10 },
      { name: 'loadUnloadTime', label: 'Время на погрузку‑выгрузку, ч (tпв)', min: 0, step: 0.01, defaultValue: 0.2 },
      {
        name: 'singleOperationTime',
        label: 'Время одной операции (погрузка или выгрузка), ч (tп)',
        min: 0,
        step: 0.01,
        defaultValue: 0.1,
      },
      { name: 'loadedDistance1', label: 'Гружёный пробег в прямом направлении, км (lг₁)', min: 0, step: 0.1, defaultValue: 16 },
      { name: 'loadedDistance2', label: 'Гружёный пробег в обратном направлении, км (lг₂)', min: 0, step: 0.1, defaultValue: 16 },
      { name: 'zeroRun1', label: 'Первый нулевой пробег, км (lн₁)', min: 0, step: 0.1, defaultValue: 12 },
      { name: 'zeroRun2', label: 'Второй нулевой пробег, км (lн₂)', min: 0, step: 0.1, defaultValue: 9 },
      { name: 'technicalSpeed', label: 'Среднетехническая скорость, км/ч (Vт)', min: 0, step: 0.1, defaultValue: 27 },
    ],
    calculate: (values) => {
      const payload = toNumber(values.payload);
      const loadFactor = toNumber(values.loadFactor);
      const dutyTime = toNumber(values.dutyTime);
      const loadUnloadTime = toNumber(values.loadUnloadTime);
      const singleOperationTime = toNumber(values.singleOperationTime);
      const loadedDistance1 = toNumber(values.loadedDistance1);
      const loadedDistance2 = toNumber(values.loadedDistance2);
      const zeroRun1 = toNumber(values.zeroRun1);
      const zeroRun2 = toNumber(values.zeroRun2);
      const technicalSpeed = toNumber(values.technicalSpeed);

      const operationTime = singleOperationTime || (loadUnloadTime > 0 ? loadUnloadTime / 2 : 0); // tп = tв = 0,5·tпв
      const routeLength = loadedDistance1 + loadedDistance2; // lм

      const tripTime1 = safeDivide(loadedDistance1, technicalSpeed) + loadUnloadTime; // tе₁
      const tripTime2 = safeDivide(loadedDistance2, technicalSpeed) + loadUnloadTime; // tе₂
      const turnaroundTime = tripTime1 + tripTime2; // tо
      const avgTripTime = safeDivide(turnaroundTime, 2); // tеср (Zео = 2)

      const payloadPerTrip = payload * loadFactor; // Qе = q·γ
      const tonnagePerTurn = payloadPerTrip * 2; // Qо

      const tonneKmTrip1 = payloadPerTrip * loadedDistance1; // Pе₁
      const tonneKmTrip2 = payloadPerTrip * loadedDistance2; // Pе₂
      const tonneKmPerTurn = tonneKmTrip1 + tonneKmTrip2; // Pо = Pе₁ + Pе₂

      const throughputSingleRaw = operationTime > 0 ? safeDivide(turnaroundTime, operationTime) : 0; // Aэ′ вариант 1
      const throughputSingle = Math.max(Math.floor(throughputSingleRaw), 1);
      const throughputDualRaw = operationTime > 0 ? safeDivide(avgTripTime, operationTime) : 0; // Aэ′ вариант 2
      const throughputDualGroups = Math.max(Math.floor(throughputDualRaw), 1);

      const essentialTripTime = safeDivide(loadedDistance2, technicalSpeed) + loadUnloadTime; // tен

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

        let tripsOnLeg1 = intTurnovers; // Zе1
        let tripsOnLeg2 = intTurnovers; // Zе2

        if (remainder >= essentialTripTime) {
          tripsOnLeg2 += 1; // дополнительная ездка на обратном плече
        }

        const totalTrips = tripsOnLeg1 + tripsOnLeg2; // Zе = Zе1 + Zе2

        const tonnage = payloadPerTrip * totalTrips; // Qнj
        const tonneKm = tonneKmTrip1 * tripsOnLeg1 + tonneKmTrip2 * tripsOnLeg2; // Pнj

        const startsAtP1 = j % 2 !== 0; // чередуем пункты A (П1) и B (П2)
        const isWholeTurn = Math.abs(rawTurnovers - intTurnovers) < 1e-9;
        const turnoverDistance = routeLength * intTurnovers;

        let totalDistance;
        if (startsAtP1) {
          totalDistance = isWholeTurn
            ? zeroRun1 + turnoverDistance + zeroRun1
            : zeroRun1 + turnoverDistance + zeroRun2; // Lобщj (подача в пункт A)
        } else {
          totalDistance = isWholeTurn
            ? zeroRun2 + turnoverDistance + zeroRun2
            : zeroRun2 + turnoverDistance + zeroRun1; // Lобщj (подача в пункт B)
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
        "Пропускная способность Aэ′ (один пункт), авто": formatNumber(throughputSingleRaw),
        'Принятое количество авто Aэ (один пункт), авто': throughputSingle,
        "Пропускная способность Aэ′ (два пункта), группы": formatNumber(throughputDualRaw),
        'Принятое число групп Aэ (два пункта), группы': throughputDualGroups,
        'Расчёт для подачи в два пункта (j группы)': {
          type: 'table',
          headers: ['j', 'Tмj, ч', 'Zоj = INT(Tмj/tо)', 'ΔTнj, ч', 'Zе₁', 'Zе₂', 'Zе', 'Qнj, т', 'Pнj, ткм'],
          columns: ['index', 'availableTime', 'intTurnovers', 'remainder', 'tripsOnLeg1', 'tripsOnLeg2', 'totalTrips', 'tonnage', 'tonneKm'],
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
    id: 'fleet-ring-route',
    name:
      'Методика расчёта показателей работы группы автомобилей на кольцевом маршруте',
    mode: 'fleet',
    description:
      'Кольцевой маршрут с двумя погрузочными пунктами, учёт пропускной способности и дополнительных ездок при остатке времени.',
    inputs: [
      { name: 'payload', label: 'Грузоподъёмность, т (q)', min: 0, step: 0.1, defaultValue: 10 },
      { name: 'loadFactor', label: 'Коэф. статического использования (γ)', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
      { name: 'dutyTime', label: 'Плановое время в наряде, ч (Tн)', min: 0, step: 0.1, defaultValue: 8 },
      {
        name: 'loadUnloadTime',
        label: 'Время на погрузку-выгрузку на ездку, ч (tпв)',
        min: 0,
        step: 0.01,
        defaultValue: 0.2,
      },
      {
        name: 'loadedDistance1',
        label: 'Первый гружёный пробег, км (lг₁)',
        min: 0,
        step: 0.1,
        defaultValue: 16,
      },
      {
        name: 'loadedDistance2',
        label: 'Второй гружёный пробег, км (lг₂)',
        min: 0,
        step: 0.1,
        defaultValue: 7,
      },
      { name: 'zeroRun1', label: 'Первый нулевой пробег, км (lн₁)', min: 0, step: 0.1, defaultValue: 7 },
      { name: 'zeroRun2', label: 'Второй нулевой пробег, км (lн₂)', min: 0, step: 0.1, defaultValue: 11 },
      { name: 'zeroRun3', label: 'Третий нулевой пробег, км (lн₃)', min: 0, step: 0.1, defaultValue: 8 },
      { name: 'emptyDistance1', label: 'Первый холостой пробег, км (lх₁)', min: 0, step: 0.1, defaultValue: 8 },
      { name: 'emptyDistance2', label: 'Второй холостой пробег, км (lх₂)', min: 0, step: 0.1, defaultValue: 8 },
      {
        name: 'technicalSpeed',
        label: 'Среднетехническая скорость, км/ч (Vт)',
        min: 0,
        step: 0.1,
        defaultValue: 25,
      },
      {
        name: 'singleOperationTime',
        label: 'Максимальная операция (Rmax), ч (tп = tв)',
        min: 0,
        step: 0.01,
        defaultValue: 0.25,
      },
    ],
    calculate: (values) => {
      const payload = toNumber(values.payload);
      const loadFactor = toNumber(values.loadFactor);
      const dutyTime = toNumber(values.dutyTime);
      const loadUnloadTime = toNumber(values.loadUnloadTime);
      const loadedDistance1 = toNumber(values.loadedDistance1);
      const loadedDistance2 = toNumber(values.loadedDistance2);
      const zeroRun1 = toNumber(values.zeroRun1);
      const zeroRun2 = toNumber(values.zeroRun2);
      const zeroRun3 = toNumber(values.zeroRun3);
      const emptyDistance1 = toNumber(values.emptyDistance1);
      const emptyDistance2 = toNumber(values.emptyDistance2);
      const technicalSpeed = toNumber(values.technicalSpeed);
      const operationTime = toNumber(values.singleOperationTime);

      const routeLength = loadedDistance1 + emptyDistance1 + loadedDistance2 + emptyDistance2; // lм

      const tripTime1 = safeDivide(loadedDistance1 + emptyDistance1, technicalSpeed) + loadUnloadTime; // tе₁
      const tripTime2 = safeDivide(loadedDistance2 + emptyDistance2, technicalSpeed) + loadUnloadTime; // tе₂
      const turnaroundTime = tripTime1 + tripTime2; // tо
      const avgTripTime = safeDivide(turnaroundTime, 2); // tеср

      const payloadPerTrip1 = payload * loadFactor; // Qе1 = q·γ₁
      const payloadPerTrip2 = payload * loadFactor; // Qе2 = q·γ₂
      const tonnagePerTurn = payloadPerTrip1 + payloadPerTrip2; // Qо

      const tonneKmTrip1 = payloadPerTrip1 * loadedDistance1; // Pе₁
      const tonneKmTrip2 = payloadPerTrip2 * loadedDistance2; // Pе₂
      const tonneKmPerTurn = tonneKmTrip1 + tonneKmTrip2; // Pо

      const throughputSingleRaw = operationTime > 0 ? safeDivide(turnaroundTime, operationTime) : 0; // вариант 1
      const throughputSingle = Math.max(Math.floor(throughputSingleRaw), 1);
      const throughputDualRaw = operationTime > 0 ? safeDivide(avgTripTime, operationTime) : 0; // вариант 2
      const throughputDualGroups = Math.max(Math.floor(throughputDualRaw), 1);

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
        const intTurnovers = Math.floor(rawTurnovers); // Zоj
        const remainder = boundedTime - intTurnovers * turnaroundTime; // ΔTнj

        let tripsOnLeg1 = intTurnovers; // Zе1
        let tripsOnLeg2 = intTurnovers; // Zе2

        const needBothTrips = tripTime1 + tripTime2;
        if (remainder + 1e-9 >= needBothTrips) {
          tripsOnLeg1 += 1;
          tripsOnLeg2 += 1;
        } else if (remainder + 1e-9 >= tripTime1) {
          tripsOnLeg1 += 1;
        }

        const totalTrips = tripsOnLeg1 + tripsOnLeg2; // Zеj

        const tonnage = payloadPerTrip1 * tripsOnLeg1 + payloadPerTrip2 * tripsOnLeg2; // Qнj
        const tonneKm = tonneKmTrip1 * tripsOnLeg1 + tonneKmTrip2 * tripsOnLeg2; // Pнj

        const startsAtP1 = j % 2 !== 0;
        const isWholeTurn = Math.abs(rawTurnovers - intTurnovers) < 1e-9;
        const turnoverDistance = routeLength * intTurnovers;
        let totalDistance;
        if (startsAtP1) {
          totalDistance = isWholeTurn
            ? zeroRun1 + turnoverDistance + zeroRun3 - emptyDistance2
            : zeroRun1 + turnoverDistance + zeroRun2;
        } else {
          totalDistance = isWholeTurn
            ? zeroRun2 + turnoverDistance + zeroRun2
            : zeroRun2 + turnoverDistance + zeroRun3 - emptyDistance2;
        }

        const actualDuty = safeDivide(totalDistance, technicalSpeed) + totalTrips * loadUnloadTime; // Тнj факт

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
        'Выработка за первую ездку Qе₁, т': formatNumber(payloadPerTrip1),
        'Выработка за вторую ездку Qе₂, т': formatNumber(payloadPerTrip2),
        'Выработка за оборот Qо, т': formatNumber(tonnagePerTurn),
        'Тонно-километры за первую ездку Pе₁, ткм': formatNumber(tonneKmTrip1),
        'Тонно-километры за вторую ездку Pе₂, ткм': formatNumber(tonneKmTrip2),
        'Тонно-километры за оборот Pо, ткм': formatNumber(tonneKmPerTurn),
        "Пропускная способность Aэ′ (один пункт), авто": formatNumber(throughputSingleRaw),
        'Принятое количество авто Aэ (один пункт), авто': throughputSingle,
        "Пропускная способность Aэ′ (два пункта), группы": formatNumber(throughputDualRaw),
        'Принятое число групп Aэ (два пункта), группы': throughputDualGroups,
        'Расчёт для подачи в два пункта (j группы)': {
          type: 'table',
          headers: ['j', 'Tмj, ч', 'Zоj = INT(Tмj/tо)', 'ΔTнj, ч', 'Zе₁', 'Zе₂', 'Zе', 'Qнj, т', 'Pнj, ткм'],
          columns: ['index', 'availableTime', 'intTurnovers', 'remainder', 'tripsOnLeg1', 'tripsOnLeg2', 'totalTrips', 'tonnage', 'tonneKm'],
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
];

export { fleetMethods };
