import { formatNumber, safeDivide } from '../../utils.js';

const defaultVehicleConfig = {
  payload: 5,
  loadFactor: 1,
  serviceTimePerTon: 0.1,
  technicalSpeed: 25,
};

const defaultRequests = [
  { route: 'A6B2B2A6', shipper: 'A6', consignee: 'B2', volume: 20, workTime: 10 },
  { route: 'B2F1F1B2', shipper: 'B2', consignee: 'F1', volume: 30, workTime: 9 },
  { route: 'F3E4E4F3', shipper: 'F3', consignee: 'E4', volume: 70, workTime: 8 },
  { route: 'C3D5D5C3', shipper: 'C3', consignee: 'D5', volume: 40, workTime: 8 },
  { route: 'E4A3A3E4', shipper: 'E4', consignee: 'A3', volume: 50, workTime: 9 },
  { route: 'D5D1D1D5', shipper: 'D5', consignee: 'D1', volume: 60, workTime: 12 },
  { route: 'E4F3F3E4', shipper: 'E4', consignee: 'F3', volume: 40, workTime: 8 },
];

const defaultRouteDistances = {
  A6B2B2A6: { loadedDistance: 15, emptyDistance: 15, zeroRun1: 15, zeroRun2: 15 },
  B2F1F1B2: { loadedDistance: 18, emptyDistance: 18, zeroRun1: 12, zeroRun2: 18 },
  F3E4E4F3: { loadedDistance: 6, emptyDistance: 6, zeroRun1: 12, zeroRun2: 9 },
  C3D5D5C3: { loadedDistance: 9, emptyDistance: 9, zeroRun1: 6, zeroRun2: 9 },
  E4A3A3E4: { loadedDistance: 15, emptyDistance: 15, zeroRun1: 9, zeroRun2: 9 },
  D5D1D1D5: { loadedDistance: 15, emptyDistance: 15, zeroRun1: 9, zeroRun2: 12 },
  E4F3F3E4: { loadedDistance: 6, emptyDistance: 6, zeroRun1: 9, zeroRun2: 12 },
};

const getDefaultInputs = () => ({
  vehicleConfig: { ...defaultVehicleConfig },
  requests: defaultRequests.map((req) => ({ ...req })),
  routeDistances: JSON.parse(JSON.stringify(defaultRouteDistances)),
});

const calculateRoute = ({
  payload,
  loadFactor,
  shiftDuration,
  serviceTime,
  distances,
  technicalSpeed,
}) => {
  const routeLength = distances.loadedDistance + distances.emptyDistance;
  const tripTime = safeDivide(routeLength, technicalSpeed) + serviceTime;
  const tonnagePerTrip = payload * loadFactor;
  const tonKmPerTrip = tonnagePerTrip * distances.loadedDistance;

  const theoreticalTrips = safeDivide(shiftDuration, tripTime);
  const wholeTrips = Math.floor(theoreticalTrips);
  const deltaTime = shiftDuration - wholeTrips * tripTime;
  const requiredTime = safeDivide(distances.loadedDistance, technicalSpeed) + serviceTime;
  const canExtraTrip = technicalSpeed > 0 && deltaTime >= requiredTime;
  const actualTrips = wholeTrips + (canExtraTrip ? 1 : 0);

  const totalTonnage = tonnagePerTrip * actualTrips;
  const totalTonKm = tonKmPerTrip * actualTrips;
  const totalDistance = distances.zeroRun1 + routeLength * actualTrips + distances.zeroRun2;
  const feasible = tripTime < shiftDuration;

  return {
    routeLength,
    tripTime,
    actualTrips,
    totalTonnage,
    totalTonKm,
    totalDistance,
    feasible,
  };
};

const calculatePlan = (inputs = getDefaultInputs()) => {
  const vehicleConfig = inputs.vehicleConfig ?? getDefaultInputs().vehicleConfig;
  const requests = inputs.requests ?? getDefaultInputs().requests;
  const routeDistances = inputs.routeDistances ?? getDefaultInputs().routeDistances;

  const serviceTime = vehicleConfig.payload * vehicleConfig.serviceTimePerTon;

  const planRows = requests
    .map((request) => {
      const distances = routeDistances[request.route];
      if (!distances) return null;

      const base = calculateRoute({
        payload: vehicleConfig.payload,
        loadFactor: vehicleConfig.loadFactor,
        shiftDuration: request.workTime,
        serviceTime,
        distances,
        technicalSpeed: vehicleConfig.technicalSpeed,
      });

      const vehiclesNeeded = base.totalTonnage > 0 ? Math.ceil(request.volume / base.totalTonnage) : 0;
      const plannedTonnage = base.totalTonnage * vehiclesNeeded;
      const plannedTonKm = base.totalTonKm * vehiclesNeeded;
      const plannedDistance = base.totalDistance * vehiclesNeeded;

      return {
        route: request.route,
        feasible: base.feasible,
        plannedTonnage,
        plannedTonKm,
        plannedDistance,
        plannedDutyTime: 0,
        vehiclesNeeded,
      };
    })
    .filter(Boolean);

  const totals = planRows.reduce(
    (acc, row) => ({
      plannedTonnage: acc.plannedTonnage + row.plannedTonnage,
      plannedTonKm: acc.plannedTonKm + row.plannedTonKm,
      plannedDistance: acc.plannedDistance + row.plannedDistance,
      plannedDutyTime: acc.plannedDutyTime + row.plannedDutyTime,
      vehiclesNeeded: acc.vehiclesNeeded + row.vehiclesNeeded,
    }),
    { plannedTonnage: 0, plannedTonKm: 0, plannedDistance: 0, plannedDutyTime: 0, vehiclesNeeded: 0 },
  );

  return {
    vehicleConfig: { ...vehicleConfig, serviceTime },
    requests,
    routeDistances,
    planRows: planRows.map((row) => ({
      ...row,
      plannedTonnageLabel: formatNumber(row.plannedTonnage),
      plannedTonKmLabel: formatNumber(row.plannedTonKm),
      plannedDistanceLabel: formatNumber(row.plannedDistance),
      plannedDutyTimeLabel: formatNumber(row.plannedDutyTime),
      feasibilityLabel: row.feasible ? 'tо < Tн' : 'tо ≥ Tн',
    })),
    totals: {
      plannedTonnageLabel: formatNumber(totals.plannedTonnage),
      plannedTonKmLabel: formatNumber(totals.plannedTonKm),
      plannedDistanceLabel: formatNumber(totals.plannedDistance),
      plannedDutyTimeLabel: formatNumber(totals.plannedDutyTime),
      vehiclesNeeded: totals.vehiclesNeeded,
    },
  };
};

const topographicPlanning = { calculatePlan, getDefaultInputs };

export { topographicPlanning };
