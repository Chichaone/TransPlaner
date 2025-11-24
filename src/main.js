import { methods } from './data/methods.js';
import { isolatedPlanning } from './data/planning/isolated.js';
import { topographicPlanning } from './data/planning/topographic.js';
import { formatNumber } from './utils.js';

const app = document.getElementById('app');

let currentTab = 'calculators';
let currentMethod = methods[0];
let lastResults = null;
let isFleetMode = false;
let currentPlanMode = 'isolation';
let isolationInputs = isolatedPlanning.getDefaultInputs();
let isolationDraft = isolatedPlanning.getDefaultInputs();
let topographicInputs = topographicPlanning.getDefaultInputs();
let topographicDraft = topographicPlanning.getDefaultInputs();

const shipments = [];
const planAssignments = {};

const addShipment = ({ shipper, consignee, volume, workTime }) => {
  const id = shipments.length + 1;
  shipments.push({
    id,
    shipper,
    consignee,
    volume,
    workTime,
  });
  planAssignments[id] = currentMethod.id;
};

const createElement = (tag, className, textContent) => {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (typeof textContent === 'string') {
    element.textContent = textContent;
  }
  return element;
};

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const renderTabNavigation = () => {
  const nav = createElement('div', 'tab-nav');

  const calculatorsButton = createElement('button', null, 'Методики расчёта');
  calculatorsButton.type = 'button';
  calculatorsButton.classList.toggle('active', currentTab === 'calculators');
  calculatorsButton.addEventListener('click', () => {
    if (currentTab !== 'calculators') {
      currentTab = 'calculators';
      render();
    }
  });

  const planButton = createElement('button', null, 'План перевозок');
  planButton.type = 'button';
  planButton.classList.toggle('active', currentTab === 'plan');
  planButton.addEventListener('click', () => {
    if (currentTab !== 'plan') {
      currentTab = 'plan';
      render();
    }
  });

  nav.append(calculatorsButton, planButton);
  return nav;
};

const renderModeToggle = () => {
  const wrapper = createElement('div', 'mode-toggle');
  const label = createElement('label', 'mode-toggle__label');
  label.htmlFor = 'fleet-mode-toggle';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isFleetMode;
  checkbox.id = 'fleet-mode-toggle';
  checkbox.className = 'mode-toggle__input';
  checkbox.addEventListener('change', () => {
    isFleetMode = checkbox.checked;
    const nextMethods = methods.filter((method) => method.mode === (isFleetMode ? 'fleet' : 'single'));
    if (nextMethods.length) {
      currentMethod = nextMethods[0];
    }
    lastResults = null;
    render();
  });

  const switchTrack = createElement('span', 'mode-toggle__switch');
  switchTrack.appendChild(createElement('span', 'mode-toggle__handle'));
  const title = createElement('span', 'mode-toggle__title', 'Группа авто');

  label.append(checkbox, switchTrack, title);

  const preview = createElement('div', 'mode-toggle__preview');
  const oppositeMode = isFleetMode ? 'single' : 'fleet';
  const oppositeMethods = methods.filter((method) => method.mode === oppositeMode);
  const previewTitle = createElement(
    'div',
    'mode-toggle__preview-title',
    oppositeMode === 'fleet' ? 'Предпоказ: группы авто' : 'Предпоказ: 1 авто'
  );
  const previewList = createElement('div', 'mode-toggle__preview-list');
  const previewItems = oppositeMethods.slice(0, 3);

  previewItems.forEach((method) => {
    previewList.appendChild(createElement('span', 'mode-toggle__preview-pill', method.name));
  });

  if (oppositeMethods.length > previewItems.length) {
    previewList.appendChild(
      createElement('span', 'mode-toggle__preview-pill mode-toggle__preview-pill--more', `+${
        oppositeMethods.length - previewItems.length
      }`)
    );
  }

  preview.append(previewTitle, previewList);
  wrapper.append(label, preview);
  return wrapper;
};

const renderMethodSelector = (availableMethods) => {
  const container = createElement('div', 'method-selector');

  availableMethods.forEach((method) => {
    const button = createElement('button');
    button.type = 'button';
    button.textContent = method.name;
    button.classList.toggle('active', method.id === currentMethod.id);
    button.addEventListener('click', () => {
      currentMethod = method;
      lastResults = null;
      render();
    });

    const badge = createElement('span', `method-badge method-badge--${method.mode}`);
    badge.title = method.mode === 'fleet' ? 'Методика для группы автомобилей' : 'Методика для одного авто';
    button.appendChild(badge);
    container.appendChild(button);
  });

  return container;
};

const renderDescription = () => {
  const description = createElement('p', 'method-description');
  description.textContent = currentMethod.description;
  return description;
};

const createField = (inputConfig) => {
  const field = createElement('div', 'field');
  const label = createElement('label');
  label.htmlFor = inputConfig.name;
  label.textContent = inputConfig.label;

  let input;
  const inputType = inputConfig.type || (inputConfig.name === 'segmentData' ? 'text' : 'number');

  input = document.createElement('input');
  input.type = inputType;
  input.name = inputConfig.name;
  input.id = inputConfig.name;
  input.required = inputType !== 'text';

  if (Object.prototype.hasOwnProperty.call(inputConfig, 'defaultValue')) {
    input.value = inputConfig.defaultValue;
  }

  if (inputType === 'number') {
    if (Object.prototype.hasOwnProperty.call(inputConfig, 'min')) {
      input.min = String(inputConfig.min);
    }
    if (Object.prototype.hasOwnProperty.call(inputConfig, 'max')) {
      input.max = String(inputConfig.max);
    }
    if (Object.prototype.hasOwnProperty.call(inputConfig, 'step')) {
      input.step = String(inputConfig.step);
    }
  } else if (inputConfig.placeholder) {
    input.placeholder = inputConfig.placeholder;
  }

  field.append(label, input);
  return field;
};

const renderForm = () => {
  const form = document.createElement('form');
  const grid = createElement('div', 'form-grid');

  currentMethod.inputs.forEach((inputConfig) => {
    grid.appendChild(createField(inputConfig));
  });

  const actions = createElement('div', 'actions');
  const submitButton = createElement('button', 'calculate');
  submitButton.type = 'submit';
  submitButton.textContent = 'Рассчитать';
  actions.appendChild(submitButton);

  form.append(grid, actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const values = {};
    for (const [key, value] of formData.entries()) {
      values[key] = value;
    }
    lastResults = currentMethod.calculate(values);
    renderResults();
  });

  return form;
};

const renderResults = () => {
  let resultsContainer = document.querySelector('.results');
  if (!resultsContainer) {
    resultsContainer = createElement('section', 'results');
    const heading = createElement('h2');
    heading.textContent = 'Итоги расчёта';
    resultsContainer.appendChild(heading);
    app.appendChild(resultsContainer);
  }

  resultsContainer.innerHTML = '';
  const heading = createElement('h2');
  heading.textContent = 'Итоги расчёта';
  resultsContainer.appendChild(heading);

  if (!lastResults) {
    const empty = createElement('div', 'empty-state');
    empty.textContent = 'Заполните форму и нажмите «Рассчитать», чтобы увидеть результаты.';
    resultsContainer.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'results-table';
  const tbody = document.createElement('tbody');

  Object.entries(lastResults).forEach(([name, value]) => {
    const row = document.createElement('tr');
    const titleCell = document.createElement('th');
    titleCell.scope = 'row';
    titleCell.textContent = name;

    const valueCell = document.createElement('td');

    if (Array.isArray(value)) {
      const nestedTable = document.createElement('table');
      nestedTable.className = 'results-subtable';

      const headers = value.length && typeof value[0] === 'object' ? Object.keys(value[0]) : ['Значение'];
      const nestedThead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headers.forEach((header) => {
        headerRow.appendChild(createElement('th', null, header));
      });
      nestedThead.appendChild(headerRow);
      nestedTable.appendChild(nestedThead);

      const nestedTbody = document.createElement('tbody');
      value.forEach((item) => {
        const nestedRow = document.createElement('tr');
        if (item && typeof item === 'object') {
          headers.forEach((key) => {
            nestedRow.appendChild(createElement('td', null, item[key] !== undefined ? String(item[key]) : ''));
          });
        } else {
          nestedRow.appendChild(createElement('td', null, String(item)));
        }
        nestedTbody.appendChild(nestedRow);
      });
      nestedTable.appendChild(nestedTbody);
      valueCell.appendChild(nestedTable);
    } else if (value && typeof value === 'object' && value.type === 'table') {
      const nestedTable = document.createElement('table');
      nestedTable.className = 'results-subtable';

      const nestedThead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      value.headers.forEach((header) => {
        headerRow.appendChild(createElement('th', null, header));
      });
      nestedThead.appendChild(headerRow);
      nestedTable.appendChild(nestedThead);

      const nestedTbody = document.createElement('tbody');
      const columnKeys = value.columns || null;
      const fallbackKeys = ['index', 'trips', 'tonnage', 'tonneKm', 'totalDistance', 'actualDutyTime'];

      value.rows.forEach((item) => {
        const nestedRow = document.createElement('tr');
        const keysToUse = columnKeys && columnKeys.length ? columnKeys : fallbackKeys;

        keysToUse.forEach((key) => {
          const cellValue = item[key];
          nestedRow.appendChild(createElement('td', null, cellValue !== undefined ? String(cellValue) : ''));
        });

        nestedTbody.appendChild(nestedRow);
      });
      nestedTable.appendChild(nestedTbody);
      valueCell.appendChild(nestedTable);
    } else {
      valueCell.textContent = typeof value === 'number' ? value.toString() : String(value);
    }

    row.append(titleCell, valueCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  resultsContainer.appendChild(table);
};

const renderPlanGrid = () => {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const numbers = ['1', '2', '3', '4', '5', '6'];
  const table = createElement('table', 'plan-grid-table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.appendChild(createElement('th'));
  numbers.forEach((number) => {
    const cell = createElement('th', null, number);
    headerRow.appendChild(cell);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  letters.forEach((letter, rowIndex) => {
    const row = document.createElement('tr');
    row.appendChild(createElement('th', null, letter));
    numbers.forEach((_, colIndex) => {
      const cell = document.createElement('td');
      if (rowIndex === 2 && colIndex === 2) {
        cell.textContent = 'АТП';
        cell.className = 'depot-cell';
      }
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
};

const renderSimpleTable = (headers, rows) => {
  const table = createElement('table', 'shipments-table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach((title) => {
    headerRow.appendChild(createElement('th', null, title));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    headers.forEach((key) => {
      const value = row[key];
      tr.appendChild(createElement('td', null, value === undefined || value === null ? '' : String(value)));
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
};

const renderPlanAssignments = () => {
  const table = createElement('table', 'shipments-table');

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['№', 'Грузоотправитель', 'Грузополучатель', 'Объём, т', 'Время работы, ч', 'Метод расчёта', 'Действия'].forEach((title) => {
    headerRow.appendChild(createElement('th', null, title));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  if (!shipments.length) {
    const emptyRow = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'empty-state';
    cell.textContent = 'Добавьте заявки, чтобы сформировать план перевозок.';
    emptyRow.appendChild(cell);
    tbody.appendChild(emptyRow);
  } else {
    shipments.forEach((shipment) => {
      const row = document.createElement('tr');
      row.appendChild(createElement('td', null, String(shipment.id)));
      row.appendChild(createElement('td', null, shipment.shipper));
      row.appendChild(createElement('td', null, shipment.consignee));
      row.appendChild(createElement('td', null, String(shipment.volume)));
      row.appendChild(createElement('td', null, String(shipment.workTime)));

      const methodCell = document.createElement('td');
      const select = document.createElement('select');
      methods.forEach((method) => {
        const option = document.createElement('option');
        option.value = method.id;
        option.textContent = method.name;
        if (planAssignments[shipment.id] === method.id) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      select.addEventListener('change', (event) => {
        planAssignments[shipment.id] = event.target.value;
      });
      methodCell.appendChild(select);
      row.appendChild(methodCell);

      const actionsCell = document.createElement('td');
      const openButton = createElement('button', 'link-button', 'Открыть расчёт');
      openButton.type = 'button';
      openButton.addEventListener('click', () => {
        const selectedMethod = methods.find((method) => method.id === planAssignments[shipment.id]);
        if (selectedMethod) {
          currentMethod = selectedMethod;
          currentTab = 'calculators';
          lastResults = null;
          render();
        }
      });
      actionsCell.appendChild(openButton);
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });
  }

  table.appendChild(tbody);
  return table;
};

const renderPlanModeNav = () => {
  const nav = createElement('div', 'plan-mode-nav');
  const modes = [
    { id: 'isolation', label: 'Изолированное планирование' },
    { id: 'topographic', label: 'Топографическое планирование' },
    { id: 'requests', label: 'Журнал заявок' },
  ];

  modes.forEach((mode) => {
    const button = createElement('button', currentPlanMode === mode.id ? 'active' : null, mode.label);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (currentPlanMode !== mode.id) {
        currentPlanMode = mode.id;
        render();
      }
    });
    nav.appendChild(button);
  });

  return nav;
};

const bindNumberChange = (input, onChange) => {
  input.addEventListener('input', () => {
    const value = Number(input.value);
    onChange(Number.isFinite(value) ? value : 0);
  });
};

const renderVehicleConfigEditor = (draft, setDraft) => {
  const card = createElement('div', 'plan-card');
  card.appendChild(createElement('h3', null, 'Параметры подвижного состава'));

  const form = document.createElement('form');
  form.className = 'plan-config-grid';

  const fields = [
    { name: 'payload', label: 'Грузоподъёмность, т', step: 'any' },
    { name: 'loadFactor', label: 'Коэффициент использования грузоподъёмности', step: 'any' },
    { name: 'serviceTimePerTon', label: 'Время на погрузку-выгрузку, ч/т', step: 'any' },
    { name: 'technicalSpeed', label: 'Среднетехническая скорость, км/ч', step: 'any' },
  ];

  fields.forEach((fieldConfig) => {
    const field = createElement('label', 'plan-field');
    field.textContent = fieldConfig.label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = fieldConfig.step;
    input.value = draft.vehicleConfig[fieldConfig.name];
    bindNumberChange(input, (value) => {
      setDraft({
        ...draft,
        vehicleConfig: { ...draft.vehicleConfig, [fieldConfig.name]: value },
      });
    });
    field.appendChild(input);
    form.appendChild(field);
  });

  const derived = createElement(
    'p',
    'plan-hint',
    `Время на погрузку-выгрузку за ездку: ${formatNumber(
      draft.vehicleConfig.payload * draft.vehicleConfig.serviceTimePerTon,
    )} ч`,
  );
  card.append(form, derived);
  return card;
};

const renderRequestsEditor = (draft, setDraft) => {
  const card = createElement('div', 'plan-card');
  card.appendChild(createElement('h3', null, 'Исходные заявки и режим работы (табл. 17)'));

  const table = document.createElement('table');
  table.className = 'plan-editable-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Маршрут', 'ГО', 'ГП', 'Объём, т', 'Время работы, ч'].forEach((title) => {
    headRow.appendChild(createElement('th', null, title));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  draft.requests.forEach((item, index) => {
    const row = document.createElement('tr');

    const routeInput = document.createElement('input');
    routeInput.type = 'text';
    routeInput.value = item.route;
    routeInput.addEventListener('input', () => {
      const next = draft.requests.slice();
      next[index] = { ...next[index], route: routeInput.value };
      setDraft({ ...draft, requests: next });
    });
    row.appendChild(createElement('td', null)).appendChild(routeInput);

    const shipperInput = document.createElement('input');
    shipperInput.type = 'text';
    shipperInput.value = item.shipper;
    shipperInput.addEventListener('input', () => {
      const next = draft.requests.slice();
      next[index] = { ...next[index], shipper: shipperInput.value };
      setDraft({ ...draft, requests: next });
    });
    row.appendChild(createElement('td', null)).appendChild(shipperInput);

    const consigneeInput = document.createElement('input');
    consigneeInput.type = 'text';
    consigneeInput.value = item.consignee;
    consigneeInput.addEventListener('input', () => {
      const next = draft.requests.slice();
      next[index] = { ...next[index], consignee: consigneeInput.value };
      setDraft({ ...draft, requests: next });
    });
    row.appendChild(createElement('td', null)).appendChild(consigneeInput);

    const volumeInput = document.createElement('input');
    volumeInput.type = 'number';
    volumeInput.step = 'any';
    volumeInput.value = item.volume;
    bindNumberChange(volumeInput, (value) => {
      const next = draft.requests.slice();
      next[index] = { ...next[index], volume: value };
      setDraft({ ...draft, requests: next });
    });
    row.appendChild(createElement('td', null)).appendChild(volumeInput);

    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.step = 'any';
    timeInput.value = item.workTime;
    bindNumberChange(timeInput, (value) => {
      const next = draft.requests.slice();
      next[index] = { ...next[index], workTime: value };
      setDraft({ ...draft, requests: next });
    });
    row.appendChild(createElement('td', null)).appendChild(timeInput);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  card.appendChild(table);
  return card;
};

const renderRouteDistancesEditor = (draft, setDraft) => {
  const card = createElement('div', 'plan-card');
  card.appendChild(createElement('h3', null, 'Исходные величины пробегов (табл. 18)'));

  const table = document.createElement('table');
  table.className = 'plan-editable-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Маршрут', 'lг, км', 'lх, км', 'lн1, км', 'lн2, км'].forEach((title) => {
    headRow.appendChild(createElement('th', null, title));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  Object.entries(draft.routeDistances).forEach(([route, distances]) => {
    const row = document.createElement('tr');
    row.appendChild(createElement('td', null, route));

    ['loadedDistance', 'emptyDistance', 'zeroRun1', 'zeroRun2'].forEach((key) => {
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.value = distances[key];
      bindNumberChange(input, (value) => {
        setDraft({
          ...draft,
          routeDistances: {
            ...draft.routeDistances,
            [route]: { ...draft.routeDistances[route], [key]: value },
          },
        });
      });
      cell.appendChild(input);
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  card.appendChild(table);
  return card;
};

const renderPlanVolumesEditor = (draft, setDraft) => {
  const card = createElement('div', 'plan-card');
  card.appendChild(createElement('h3', null, 'Плановые объёмы (табл. 19, Qпл)'));

  const table = document.createElement('table');
  table.className = 'plan-editable-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Маршрут', 'Qпл, т'].forEach((title) => {
    headRow.appendChild(createElement('th', null, title));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  draft.requests.forEach((request, index) => {
    const row = document.createElement('tr');
    row.appendChild(createElement('td', null, request.route));

    const volumeInput = document.createElement('input');
    volumeInput.type = 'number';
    volumeInput.step = 'any';
    volumeInput.value = request.volume;
    bindNumberChange(volumeInput, (value) => {
      const next = draft.requests.slice();
      next[index] = { ...next[index], volume: value };
      setDraft({ ...draft, requests: next });
    });
    row.appendChild(createElement('td', null)).appendChild(volumeInput);

    tbody.appendChild(row);
  });

  const total = draft.requests.reduce((sum, item) => sum + (Number(item.volume) || 0), 0);
  const totalRow = document.createElement('tr');
  totalRow.appendChild(createElement('td', 'table-total', 'Итого'));
  totalRow.appendChild(createElement('td', 'table-total', formatNumber(total)));
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
  card.appendChild(table);
  return card;
};

const renderPlanRecalculate = (onApply) => {
  const card = createElement('div', 'plan-card plan-actions-card');
  card.appendChild(createElement('h3', null, 'Пересчёт плана'));
  card.appendChild(
    createElement(
      'p',
      'plan-hint',
      'После изменения исходных данных нажмите кнопку, чтобы обновить расчёт таблицы 19.',
    ),
  );

  const button = createElement('button', 'calculate plan-recalculate', 'Рассчитать план');
  button.type = 'button';
  button.addEventListener('click', () => {
    onApply();
  });

  card.appendChild(button);
  return card;
};

const renderIsolationPlanning = () => {
  const setDraft = (nextDraft) => {
    isolationDraft = nextDraft;
    render();
  };

  const { vehicleConfig, requests, routeDistances, planRows, totals } = isolatedPlanning.calculatePlan(isolationInputs);
  const section = createElement('div', 'plan-isolation');

  const intro = createElement(
    'p',
    'plan-hint',
    'Изолированный способ расчёта использует маятниковый маршрут с обратным холостым пробегом для каждой заявки и подбирает количество автомобилей так, чтобы перекрыть плановый объём.',
  );
  section.appendChild(intro);

  section.appendChild(renderVehicleConfigEditor(isolationDraft, setDraft));
  section.appendChild(renderRequestsEditor(isolationDraft, setDraft));
  section.appendChild(renderRouteDistancesEditor(isolationDraft, setDraft));
  section.appendChild(renderPlanVolumesEditor(isolationDraft, setDraft));
  section.appendChild(
    renderPlanRecalculate(() => {
      isolationInputs = cloneValue(isolationDraft);
      render();
    }),
  );

  const resultsCard = createElement('div', 'plan-card');
  resultsCard.appendChild(createElement('h3', null, 'Плановые величины работы (табл. 19)'));

  const resultRows = planRows.map((row) => ({
    Маршрут: row.route,
    'Qпл, т': row.plannedTonnageLabel,
    'Рд, т·км': row.plannedTonKmLabel,
    'Lобщ, км': row.plannedDistanceLabel,
    'ΣTн факт, ч': row.plannedDutyTimeLabel,
    'Апл, ед.': row.vehiclesNeeded,
  }));

  const totalRow = {
    Маршрут: 'Итого',
    'Qпл, т': totals.plannedTonnageLabel,
    'Рд, т·км': totals.plannedTonKmLabel,
    'Lобщ, км': totals.plannedDistanceLabel,
    'ΣTн факт, ч': totals.plannedDutyTimeLabel,
    'Апл, ед.': totals.vehiclesNeeded,
  };

  resultsCard.appendChild(
    renderSimpleTable(
      ['Маршрут', 'Qпл, т', 'Рд, т·км', 'Lобщ, км', 'ΣTн факт, ч', 'Апл, ед.'],
      [...resultRows, totalRow],
    ),
  );

  section.appendChild(resultsCard);
  return section;
};

const renderTopographicPlanning = () => {
  const setDraft = (nextDraft) => {
    topographicDraft = nextDraft;
    render();
  };

  const { planRows, totals } = topographicPlanning.calculatePlan(topographicInputs);
  const section = createElement('div', 'plan-isolation');

  const intro = createElement(
    'p',
    'plan-hint',
    'Топографический метод опирается на общую карту заявок: для исходных данных можно скорректировать параметры подвижного состава, заявки и пробеги, затем выполнить пересчёт по условиям to < Tн.',
  );
  section.appendChild(intro);

  const gridCard = createElement('div', 'plan-card');
  gridCard.appendChild(createElement('h3', null, 'Схема района перевозок'));
  gridCard.appendChild(renderPlanGrid());
  section.appendChild(gridCard);

  section.appendChild(renderVehicleConfigEditor(topographicDraft, setDraft));
  section.appendChild(renderRequestsEditor(topographicDraft, setDraft));
  section.appendChild(renderRouteDistancesEditor(topographicDraft, setDraft));
  section.appendChild(renderPlanVolumesEditor(topographicDraft, setDraft));
  section.appendChild(
    renderPlanRecalculate(() => {
      topographicInputs = cloneValue(topographicDraft);
      render();
    }),
  );

  const resultsCard = createElement('div', 'plan-card');
  resultsCard.appendChild(createElement('h3', null, 'Плановые величины (топографический метод)'));

  const resultRows = planRows.map((row) => ({
    Маршрут: row.route,
    'Qпл, т': row.plannedTonnageLabel,
    'Рд, т·км': row.plannedTonKmLabel,
    'Lобщ, км': row.plannedDistanceLabel,
    'ΣTн факт, ч': row.plannedDutyTimeLabel,
    'Апл, ед.': row.vehiclesNeeded,
    'Проверка to < Tн': row.feasibilityLabel,
  }));

  const totalRow = {
    Маршрут: 'Итого',
    'Qпл, т': totals.plannedTonnageLabel,
    'Рд, т·км': totals.plannedTonKmLabel,
    'Lобщ, км': totals.plannedDistanceLabel,
    'ΣTн факт, ч': totals.plannedDutyTimeLabel,
    'Апл, ед.': totals.vehiclesNeeded,
    'Проверка to < Tн': '',
  };

  resultsCard.appendChild(
    renderSimpleTable(
      ['Маршрут', 'Qпл, т', 'Рд, т·км', 'Lобщ, км', 'ΣTн факт, ч', 'Апл, ед.', 'Проверка to < Tн'],
      [...resultRows, totalRow],
    ),
  );

  section.appendChild(resultsCard);
  return section;
};

const renderShipmentForm = () => {
  const card = createElement('div', 'plan-card');
  card.appendChild(createElement('h3', null, 'Добавление заявки'));

  const form = document.createElement('form');
  form.className = 'shipment-form';

  const fields = [
    { name: 'shipper', label: 'Грузоотправитель', type: 'text' },
    { name: 'consignee', label: 'Грузополучатель', type: 'text' },
    { name: 'volume', label: 'Объём, т', type: 'number', min: 0, step: 'any' },
    { name: 'workTime', label: 'Время работы, ч', type: 'number', min: 0, step: 'any' },
  ];

  fields.forEach((config) => {
    const field = createElement('label', 'shipment-field');
    field.textContent = config.label;
    const input = document.createElement('input');
    input.name = config.name;
    input.type = config.type;
    input.required = true;
    if (config.type === 'number') {
      input.min = String(config.min ?? 0);
      input.step = String(config.step ?? '1');
    }
    field.appendChild(input);
    form.appendChild(field);
  });

  const actions = createElement('div', 'shipment-actions');
  const submit = createElement('button', 'calculate', 'Добавить заявку');
  submit.type = 'submit';
  actions.appendChild(submit);
  form.appendChild(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    const shipper = String(formData.get('shipper') || '').trim();
    const consignee = String(formData.get('consignee') || '').trim();
    const volume = Number(formData.get('volume'));
    const workTime = Number(formData.get('workTime'));

    if (!shipper || !consignee || Number.isNaN(volume) || Number.isNaN(workTime)) {
      return;
    }

    addShipment({ shipper, consignee, volume, workTime });

    form.reset();
    render();
  });

  card.appendChild(form);
  return card;
};

const renderPlanView = () => {
  const container = createElement('section', 'plan-view');

  const heading = createElement('h2', null, 'Разработка плана перевозок');
  container.appendChild(heading);

  container.appendChild(renderPlanModeNav());

  if (currentPlanMode === 'isolation') {
    container.appendChild(renderIsolationPlanning());
  } else if (currentPlanMode === 'topographic') {
    container.appendChild(renderTopographicPlanning());
  } else {
    const gridCard = createElement('div', 'plan-card');
    gridCard.appendChild(createElement('h3', null, 'Схема района перевозок'));
    gridCard.appendChild(renderPlanGrid());
    container.appendChild(gridCard);

    container.appendChild(renderShipmentForm());

    const tableCard = createElement('div', 'plan-card');
    tableCard.appendChild(createElement('h3', null, 'Исходные заявки на перевозку'));
    tableCard.appendChild(renderPlanAssignments());
    container.appendChild(tableCard);

    const hint = createElement(
      'p',
      'plan-hint',
      'Выберите метод расчёта для заявки и откройте форму, чтобы выполнить детальный расчёт по выбранной методике.'
    );
    container.appendChild(hint);
  }

  return container;
};

const render = () => {
  app.innerHTML = '';
  app.appendChild(renderTabNavigation());

  if (currentTab === 'calculators') {
    const calculatorsSection = createElement('section', 'calculators');
    const availableMethods = methods.filter(
      (method) => method.mode === (isFleetMode ? 'fleet' : 'single'),
    );

    if (!availableMethods.some((method) => method.id === currentMethod.id)) {
      currentMethod = availableMethods[0];
      lastResults = null;
    }

    calculatorsSection.appendChild(renderModeToggle());
    calculatorsSection.appendChild(renderMethodSelector(availableMethods));
    calculatorsSection.appendChild(renderDescription());
    calculatorsSection.appendChild(renderForm());
    app.appendChild(calculatorsSection);
    renderResults();
  } else {
    app.appendChild(renderPlanView());
  }
};

render();
