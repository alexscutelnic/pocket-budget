// UI translation layer. English strings are the keys — t('Save') returns
// 'Сохранить' in Russian, or the key itself in English / when untranslated,
// so missing entries degrade to English rather than to blank UI.
// User data (category names, pot names, notes) is never translated.
// No imports here: period.js and format.js depend on this module.

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
];

let lang = 'en';

export function setLanguage(code) {
  lang = LANGUAGES.some((l) => l.code === code) ? code : 'en';
}

export function getLanguage() {
  return lang;
}

// Locale for Intl date formatting (month names, date order).
export function dateLocale() {
  return lang === 'ru' ? 'ru' : 'en-GB';
}

const RU = {
  // Tabs / titles
  'Home': 'Главная',
  'Pots': 'Копилки',
  'Trends': 'Тренды',
  'Settings': 'Настройки',

  // Home
  'Income': 'Доход',
  'Extra Income': 'Доп. доход',
  'Extra income': 'Доп. доход',
  'Sold something? Add it here.': 'Продали что-то? Добавьте сюда.',
  'Categories': 'Категории',
  'of {amount}': 'из {amount}',
  'remaining this period': 'осталось в этом периоде',
  'over your income this period': 'сверх дохода за период',
  'Extra': 'Доп.',
  'Spent': 'Потрачено',
  'Saved': 'Отложено',
  'Withdrew': 'Снято',
  'Safe to spend': 'Можно тратить',
  '{amount} / day': '{amount} / день',
  'Set your income': 'Укажите доход',
  "Add your monthly income in Settings to see what's left to spend.": 'Добавьте месячный доход в настройках, чтобы видеть, сколько можно тратить.',
  'Go to Settings': 'Открыть настройки',
  "It's been a while since your last backup.": 'Вы давно не делали резервную копию.',
  'Export now': 'Экспортировать',
  'No categories yet': 'Пока нет категорий',
  'Add a category in Settings to start tracking spending.': 'Добавьте категорию в настройках, чтобы отслеживать траты.',
  'No extra income yet': 'Пока нет доп. дохода',
  "One-off money you add here counts toward this period's income.": 'Разовые поступления учитываются в доходе текущего периода.',
  'Entries': 'Записи',
  'Edit': 'Изменить',
  'Transactions': 'Траты',
  'Nothing here yet': 'Пока пусто',
  'Transactions you add to this category this period will show up here.': 'Траты в этой категории за текущий период появятся здесь.',
  'No note': 'Без заметки',

  // Recap
  'Your {month} recap': 'Итоги: {month}',
  'Saved to pots': 'Отложено в копилки',
  'Taken from pots': 'Взято из копилок',
  'Left over': 'Осталось',
  'You saved {pct}% of your income.': 'Вы отложили {pct}% дохода.',
  'Most went on {category} ({amount}).': 'Больше всего ушло на «{category}» ({amount}).',
  '{category} moved most vs the period before: {delta}.': '«{category}» изменилось сильнее всего: {delta} к прошлому периоду.',
  'Done': 'Готово',

  // Transaction / income sheets
  'Add Transaction': 'Новая трата',
  'Edit Transaction': 'Изменить трату',
  'Category': 'Категория',
  'Note (optional)': 'Заметка (необязательно)',
  'e.g. Coffee with Sam': 'напр. Кофе с другом',
  'Date': 'Дата',
  'Save': 'Сохранить',
  'Delete Transaction': 'Удалить трату',
  'Delete this transaction?': 'Удалить эту трату?',
  'Add Extra Income': 'Добавить доп. доход',
  'e.g. Sold old phone': 'напр. Продал старый телефон',
  'Delete this income entry?': 'Удалить эту запись?',
  'Edit Appearance': 'Оформление',
  'Icon': 'Значок',
  'Color': 'Цвет',

  // Pots
  'No pots yet': 'Пока нет копилок',
  'saved toward targets': 'накоплено к целям',
  'Savings': 'Накопления',
  'Create a pot to start saving toward something.': 'Создайте копилку, чтобы начать откладывать.',
  'Added money': 'Пополнение',
  'Withdrawal': 'Снятие',
  'Target: {date}': 'Цель: {date}',
  'No target date': 'Без даты цели',
  'Add Money': 'Пополнить',
  'Withdraw': 'Снять',
  'History': 'История',
  'No activity yet': 'Пока нет операций',
  'Money you add or withdraw will show up here.': 'Пополнения и снятия появятся здесь.',
  'Edit Pot': 'Изменить копилку',
  'New Pot': 'Новая копилка',
  'Name': 'Название',
  'e.g. Holiday': 'напр. Отпуск',
  'Target amount': 'Целевая сумма',
  'Target date (optional)': 'Дата цели (необязательно)',
  'Archive Pot': 'Архивировать копилку',
  'Archive this pot? It will be hidden from your pots list.': 'Архивировать копилку? Она исчезнет из списка.',
  'Delete this entry?': 'Удалить эту запись?',
  'e.g. Birthday money': 'напр. Подарок на день рождения',

  // Trends
  'Last {n}': 'За {n}',
  'This period, day by day': 'Этот период, день за днём',
  'Spend per period': 'Траты по периодам',
  'Spend by category': 'Траты по категориям',
  'Total savings': 'Все накопления',
  'No spending recorded yet.': 'Трат пока нет.',
  'No pot activity yet.': 'В копилках пока пусто.',
  'On track for ~{amount} this period': 'Прогноз на период: ~{amount}',
  '{amount} more than this point last period': 'На {amount} больше, чем к этому дню прошлого периода',
  '{amount} less than this point last period': 'На {amount} меньше, чем к этому дню прошлого периода',
  'Level with this point last period': 'Наравне с прошлым периодом',
  'This period': 'Этот период',
  'Last period': 'Прошлый период',
  'Biggest mover': 'Главное изменение',
  'Tap a category to see how it breaks down.': 'Нажмите на категорию, чтобы увидеть детали.',
  'By note': 'По заметкам',
  'Nothing to show yet': 'Пока нечего показать',
  'No transactions in this range yet.': 'В этом диапазоне пока нет трат.',
  "Once you've logged some spending or added money to a pot, your trends will show up here.": 'Когда появятся траты или пополнения копилок, здесь будут графики.',

  // Settings
  'Budget': 'Бюджет',
  'Monthly Income': 'Месячный доход',
  'Not set': 'Не указан',
  'Reset Day': 'День сброса',
  'Currency': 'Валюта',
  'Language': 'Язык',
  'Subscriptions': 'Подписки',
  'Charged automatically to their category each time you open the app on or after the billing day.': 'Списываются автоматически в свою категорию при открытии приложения в день оплаты или позже.',
  'Data': 'Данные',
  'Export Data': 'Экспорт данных',
  'Import Data': 'Импорт данных',
  'Last backup: {date}': 'Последняя копия: {date}',
  'Never': 'Никогда',
  'About': 'О приложении',
  'Add Category': 'Добавить категорию',
  'Add Subscription': 'Добавить подписку',
  'Total': 'Итого',
  '{amount}/yr': '{amount}/год',
  '{monthly}/mo · {yearly}/yr': '{monthly}/мес · {yearly}/год',
  '{amount} per period': '{amount} за период',
  'Uncategorized': 'Без категории',
  'New Category': 'Новая категория',
  'Edit Category': 'Изменить категорию',
  'e.g. Groceries': 'напр. Продукты',
  'Limit per period': 'Лимит за период',
  'Archive Category': 'Архивировать категорию',
  'Archive this category? It will be hidden from Home, but its past transactions are kept.': 'Архивировать категорию? Она исчезнет с главного экрана, но её траты сохранятся.',
  'A category named "{name}" already exists.': 'Категория «{name}» уже существует.',
  'Category limits would total {total} of {income} income.': 'Лимиты категорий составят {total} из {income} дохода.',
  'Day of month your pay cycle resets (1–31)': 'День месяца, когда начинается новый период (1–31)',
  'New Subscription': 'Новая подписка',
  'Edit Subscription': 'Изменить подписку',
  'e.g. Gym': 'напр. Спортзал',
  'Amount per month': 'Сумма в месяц',
  'Billing day (1–31)': 'День списания (1–31)',
  'Archive Subscription': 'Архивировать подписку',
  'Archive this subscription? It will stop creating new transactions automatically.': 'Архивировать подписку? Новые траты создаваться не будут.',
  'Importing will overwrite all data currently on this device. Continue?': 'Импорт заменит все данные на этом устройстве. Продолжить?',
  'That file is not valid JSON.': 'Файл не является корректным JSON.',
  "That doesn't look like a Pocket Budget export file.": 'Это не похоже на файл экспорта Pocket Budget.',

  // Currency names
  'British Pound': 'Британский фунт',
  'US Dollar': 'Доллар США',
  'Euro': 'Евро',
  'Canadian Dollar': 'Канадский доллар',
  'Australian Dollar': 'Австралийский доллар',
  'New Zealand Dollar': 'Новозеландский доллар',
  'Japanese Yen': 'Японская иена',
  'Swiss Franc': 'Швейцарский франк',
  'Indian Rupee': 'Индийская рупия',
  'South African Rand': 'Южноафриканский рэнд',
};

export function t(str, vars) {
  let out = (lang !== 'en' && RU[str]) || str;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  }
  return out;
}

// ---- Plurals ------------------------------------------------------------
// Russian needs one/few/many forms (1 день, 2 дня, 5 дней), so these are
// small per-language functions rather than template strings.

const ruPluralRules = new Intl.PluralRules('ru');

function ruSelect(n, one, few, many) {
  const form = ruPluralRules.select(n);
  return form === 'one' ? one : form === 'few' ? few : many;
}

const PLURALS = {
  'days-left': {
    en: (n) => `${n} day${n === 1 ? '' : 's'} left`,
    ru: (n) => `${ruSelect(n, 'остался', 'осталось', 'осталось')} ${n} ${ruSelect(n, 'день', 'дня', 'дней')}`,
  },
  'entries-this-period': {
    en: (n) => `${n} ${n === 1 ? 'entry' : 'entries'} this period`,
    ru: (n) => `${n} ${ruSelect(n, 'запись', 'записи', 'записей')} за период`,
  },
  'saved-across-pots': {
    en: (n) => `saved across ${n} pot${n === 1 ? '' : 's'}`,
    ru: (n) => `в ${n} ${ruSelect(n, 'копилке', 'копилках', 'копилках')}`,
  },
  'last-n-periods': {
    en: (n) => `last ${n} periods`,
    ru: (n) => `за ${n} ${ruSelect(n, 'период', 'периода', 'периодов')}`,
  },
};

export function tn(key, n) {
  return (PLURALS[key][lang] || PLURALS[key].en)(n);
}

// Day-of-month phrasing differs structurally between the languages
// ("on the 25th" vs "25-го числа"), so these are helpers, not dict entries.

function enOrdinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

// "on the 25th" / "25-го числа" — subscription billing day.
export function onDay(n) {
  return lang === 'ru' ? `${n}-го числа` : `on the ${enOrdinal(n)}`;
}

// "25th" / "25-е" — standalone day of month (reset day row).
export function dayOrdinal(n) {
  return lang === 'ru' ? `${n}-е` : enOrdinal(n);
}
