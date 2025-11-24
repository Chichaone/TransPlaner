import { methods as singleMethods } from '../methods/index.js';
import { fleetMethods } from './fleet/methods.js';

const methods = [
  ...singleMethods.map((method) => ({ ...method, mode: 'single' })),
  ...fleetMethods,
];

export { methods };
