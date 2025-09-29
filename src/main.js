import { methods } from './methods.js';

const app = document.getElementById('app');

let currentMethod = methods[0];
let lastResults = null;

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

const render = () => {
  app.innerHTML = '';
  app.appendChild(renderMethodSelector());
  app.appendChild(renderDescription());
  app.appendChild(renderForm());
  renderResults();
};

render();
