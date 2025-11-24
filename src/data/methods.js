import { methods as singleMethods } from '../methods/index.js';
import { formatNumber, safeDivide, toNumber } from '../utils.js';

const fleetMethods = [
  {
    id: 'fleet-shift-balance',
    name: 'Групповое сменное задание',
    mode: 'fleet',
    description:
      'Рассчитывает суммарные показатели группы автомобилей по средним параметрам смены.',
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
    description:
      'Оценка использования сменного фонда автомобилей с учётом простоев и подготовительного времени.',
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
    description:
      'Балансирует объём перевозок между двумя плечами для одной группы автомобилей.',
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
    description:
      'Определяет структуру использования времени по типам операций для автоколонны.',
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
    description:
      'Оценивает потенциальный суточный объём перевозок группы при заданной грузоподъёмности.',
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

const methods = [
  ...singleMethods.map((method) => ({ ...method, mode: 'single' })),
  ...fleetMethods,
];

export { methods };
