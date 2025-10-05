import { methods } from './methods/index.js';

const app = document.getElementById('app');

let currentTab = 'calculators';
let currentMethod = methods[0];
let lastResults = null;

const shipments = [
  { id: 1, shipper: 'A4', consignee: 'B1', volume: 10, workTime: 8 },
  { id: 2, shipper: 'A6', consignee: 'C2', volume: 7, workTime: 9 },
  { id: 3, shipper: 'B2', consignee: 'C1', volume: 5, workTime: 6 },
  { id: 4, shipper: 'C1', consignee: 'B3', volume: 12, workTime: 10 },
  { id: 5, shipper: 'C2', consignee: 'A5', volume: 4, workTime: 7 },
  { id: 6, shipper: 'E1', consignee: 'D2', volume: 6, workTime: 10 },
  { id: 7, shipper: 'F3', consignee: 'E4', volume: 9, workTime: 9 },
];

const planAssignments = shipments.reduce((acc, shipment) => {
  acc[shipment.id] = currentMethod.id;
  return acc;
}, {});

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

const renderMethodSelector = () => {
  const container = createElement('div', 'method-selector');

  methods.forEach((method) => {
    const button = createElement('button');
    button.type = 'button';
    button.textContent = method.name;
    button.classList.toggle('active', method.id === currentMethod.id);
    button.addEventListener('click', () => {
      currentMethod = method;
      lastResults = null;
      render();
    });
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
    valueCell.textContent = typeof value === 'number' ? value.toString() : String(value);
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

  table.appendChild(tbody);
  return table;
};

const renderPlanView = () => {
  const container = createElement('section', 'plan-view');

  const heading = createElement('h2', null, 'Разработка плана перевозок');
  container.appendChild(heading);

  const gridCard = createElement('div', 'plan-card');
  gridCard.appendChild(createElement('h3', null, 'Схема района перевозок'));
  gridCard.appendChild(renderPlanGrid());
  container.appendChild(gridCard);

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

  return container;
};

const render = () => {
  app.innerHTML = '';
  app.appendChild(renderTabNavigation());

  if (currentTab === 'calculators') {
    const calculatorsSection = createElement('section', 'calculators');
    calculatorsSection.appendChild(renderMethodSelector());
    calculatorsSection.appendChild(renderDescription());
    calculatorsSection.appendChild(renderForm());
    app.appendChild(calculatorsSection);
    renderResults();
  } else {
    app.appendChild(renderPlanView());
  }
};

render();
