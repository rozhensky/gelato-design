/* ============================================================
   Gelato — Interactive Brief (Telegram Mini App)

   Onboarding wizard that captures a product brief BEFORE the
   strategy session. Per question the user can: record one or
   several voice notes (record / play / delete / re-record), and
   attach links & video URLs. Everything autosaves at the account
   level and can be resumed, edited or deleted later.

   v1 persistence: IndexedDB (local, handles audio blobs).
   The user identity comes from Telegram WebApp when available.
   Swapping the persistence layer for a real backend (Supabase)
   later only touches the `Store` object + submitBrief().
   ============================================================ */
(function () {
    'use strict';

    /* ---------- Telegram WebApp ---------- */
    var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    function tgCall(fn) { try { return fn(); } catch (e) { return undefined; } }
    if (tg) {
        tgCall(function () { tg.ready(); });
        tgCall(function () { tg.expand(); });
        tgCall(function () { tg.setHeaderColor('#EFECE5'); });
        tgCall(function () { tg.setBackgroundColor('#EFECE5'); });
        tgCall(function () { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); });
        tgCall(function () { if (tg.MainButton) tg.MainButton.hide(); });
        // keep the layout sized to Telegram's stable viewport
        var applyVH = function () {
            var h = tg.viewportStableHeight || tg.viewportHeight;
            if (h) document.documentElement.style.setProperty('--vh', h + 'px');
        };
        tgCall(function () { if (tg.onEvent) tg.onEvent('viewportChanged', applyVH); });
        applyVH();
    }
    var tgUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
    var ACCOUNT_ID = tgUser ? ('tg_' + tgUser.id) : 'local';

    /* ---------- i18n (UA default / RU) — auto from Telegram/browser language ---------- */
    var LANG = (function () {
        var saved = null;
        try { saved = localStorage.getItem('gelatoLang'); } catch (e) {}
        if (saved === 'ru' || saved === 'uk') return saved;
        var code = ((tgUser && tgUser.language_code) || navigator.language || '').toLowerCase();
        return code.indexOf('ru') === 0 ? 'ru' : 'uk';
    })();
    try { document.documentElement.lang = LANG; } catch (e) {}
    var RU = {
"Опис продукту":"Описание продукта",
"Запис не підтримується — завантажте аудіофайл":"Запись не поддерживается — загрузите аудиофайл",
"Немає доступу до мікрофона":"Нет доступа к микрофону",
"Запис надто короткий":"Запись слишком короткая",
"Натисніть, щоб записати голосову":"Нажмите, чтобы записать голосовое",
"● Запис…":"● Запись…",
"Аудіо недоступне":"Аудио недоступно",
"Не вдалося відтворити":"Не удалось воспроизвести",
"Перевірте посилання":"Проверьте ссылку",
"Інтерактивний бриф · ~10–15 хв":"Интерактивный бриф · ~10–15 мин",
"Розкажіть про ідею":"Расскажите об идее",
"10 коротких питань, щоб ми зрозуміли ваш продукт ще до стратегічної сесії. Відповідайте, як зручно — голосом, посиланнями чи відео.":"10 коротких вопросов, чтобы мы поняли ваш продукт ещё до стратегической сессии. Отвечайте, как удобно — голосом, ссылками или видео.",
"На кожне питання — одна чи кілька голосових. Можна прослухати й перезаписати.":"На каждый вопрос — одно или несколько голосовых. Можно прослушать и перезаписать.",
"Посилання та відео":"Ссылки и видео",
"Кидайте конкурентів, референси, огляди чи Loom — усе в одному місці.":"Кидайте конкурентов, референсы, обзоры или Loom — всё в одном месте.",
"Зберігається саме":"Сохраняется само",
"Можна вийти й повернутись будь-коли — відповіді лишаться на вашому акаунті.":"Можно выйти и вернуться в любой момент — ответы останутся в вашем аккаунте.",
"Огляд":"Обзор",
"Продовжити · {0}/10":"Продолжить · {0}/10",
"Розпочати":"Начать",
"Контакти":"Контакты",
"Перед початком":"Перед началом",
"Ваші контакти":"Ваши контакты",
"Лишіть контакти, щоб ми могли звʼязатися щодо стратегічної сесії.":"Оставьте контакты, чтобы мы могли связаться по поводу стратегической сессии.",
"Імʼя":"Имя",
"Як до вас звертатися":"Как к вам обращаться",
"номер телефону":"номер телефона",
"Соцмережі":"Соцсети",
"напишіть нік":"напишите ник",
"Обовʼязково: імʼя, email і телефон. Соцмережі — за бажанням.":"Обязательно: имя, email и телефон. Соцсети — по желанию.",
"Перейти до питань":"Перейти к вопросам",
"Вкажіть імʼя":"Укажите имя",
"Вкажіть коректний email":"Укажите корректный email",
"Вкажіть номер телефону":"Укажите номер телефона",
"Не вдалося зберегти контакти — перевірте бекенд":"Не удалось сохранить контакты — проверьте бэкенд",
"Запис #{0}":"Запись #{0}",
"Почнімо з головного":"Начнём с главного",
"Розкажіть про продукт своїми словами":"Расскажите о продукте своими словами",
"Перед детальними питаннями просто опишіть голосом, про що ваш продукт і навіщо ви його робите — як відчуваєте самі, без деталізації. Можна одне чи кілька повідомлень, будь-якої довжини. Далі перейдемо до конкретних питань.":"Перед подробными вопросами просто опишите голосом, о чём ваш продукт и зачем вы его делаете — как чувствуете сами, без детализации. Можно одно или несколько сообщений, любой длины. Дальше перейдём к конкретным вопросам.",
"Голосовий опис":"Голосовое описание",
"До питань":"К вопросам",
"Посилання":"Ссылки",
"Вставте посилання":"Вставьте ссылку",
"Додати":"Добавить",
"Питання {0} з {1}":"Вопрос {0} из {1}",
"Питання":"Вопросы",
"Голосова відповідь":"Голосовой ответ",
"До огляду":"К обзору",
"Далі":"Далее",
"Ще не заповнено":"Ещё не заполнено",
"Бриф надіслано":"Бриф отправлен",
"Дякуємо! Будь-які зміни, які ви додаєте далі — нові голосові чи посилання — ми отримуємо автоматично. Повторно надсилати нічого не потрібно.":"Спасибо! Любые изменения, которые вы добавите дальше — новые голосовые или ссылки — мы получаем автоматически. Повторно отправлять ничего не нужно.",
"Майже готово":"Почти готово",
"Перегляньте бриф":"Просмотрите бриф",
"Усе заповнено — можна надсилати бриф.":"Всё заполнено — можно отправлять бриф.",
"Заповнено {0} із {1}. Надіслати можна, коли заповните всі питання.":"Заполнено {0} из {1}. Отправить можно, когда заполните все вопросы.",
"Огляд · {0}/{1}":"Обзор · {0}/{1}",
"Надіслати бриф":"Отправить бриф",
"Дякуємо за підтвердження! Ми вивчимо матеріали й підготуємось до стратегічної сесії. Будь-які зміни, які ви додасте далі, ми отримаємо автоматично — повторно надсилати не потрібно.":"Спасибо за подтверждение! Мы изучим материалы и подготовимся к стратегической сессии. Любые изменения, которые вы добавите дальше, мы получим автоматически — повторно отправлять не нужно.",
"Відкрити бриф знову":"Открыть бриф снова",
"Завантаження брифу…":"Загрузка брифа…",
"Бриф не завантажився — перевірте функцію save":"Бриф не загрузился — проверьте функцию save",
"Проблема та її актуальність":"Проблема и её актуальность",
"Для кого це":"Для кого это",
"Як вирішують зараз":"Как решают сейчас",
"Суть і головна цінність":"Суть и главная ценность",
"Перший «вау»-сценарій":"Первый «вау»-сценарий",
"Функції першої версії":"Функции первой версии",
"Референси та конкуренти":"Референсы и конкуренты",
"Бренд, тон і стиль":"Бренд, тон и стиль",
"Монетизація":"Монетизация",
"Успіх і наступний крок":"Успех и следующий шаг",
"Яку проблему вирішує ваш продукт і чому вона важлива? Що зараз незручно, повільно або дорого для ваших користувачів? Наприклад: «люди витрачають години на пошук…» або «бізнес втрачає клієнтів, бо…».":"Какую проблему решает ваш продукт и почему она важна? Что сейчас неудобно, медленно или дорого для ваших пользователей? Например: «люди тратят часы на поиск…» или «бизнес теряет клиентов, потому что…».",
"Хто ваш головний користувач? Опишіть конкретну людину: вік, рід занять, ситуація. Коли й де вона скористається продуктом? Наприклад: «підприємець-початківець, який щойно відкрив магазин».":"Кто ваш главный пользователь? Опишите конкретного человека: возраст, род занятий, ситуация. Когда и где он воспользуется продуктом? Например: «начинающий предприниматель, который только что открыл магазин».",
"Як люди вирішують це завдання зараз — інші додатки, Excel, вручну чи ніяк? Що в цих способах не влаштовує і чим ви будете кращими? Додайте посилання на конкурентів, якщо є.":"Как люди решают эту задачу сейчас — другие приложения, Excel, вручную или никак? Что в этих способах не устраивает и чем вы будете лучше? Добавьте ссылки на конкурентов, если есть.",
"Опишіть продукт простими словами, ніби розповідаєте другу. Що людина зможе зробити і що отримає в результаті? Наприклад: «застосунок, де за 2 хвилини можна…».":"Опишите продукт простыми словами, будто рассказываете другу. Что человек сможет сделать и что получит в результате? Например: «приложение, где за 2 минуты можно…».",
"Уявіть, що людина вперше відкрила продукт. Проведіть нас кроками: що вона бачить, що натискає і в який момент думає «о, це справді корисно»?":"Представьте, что человек впервые открыл продукт. Проведите нас по шагам: что он видит, что нажимает и в какой момент думает «о, это действительно полезно»?",
"Які 3–5 функцій обовʼязкові для першої версії — без них продукт не має сенсу? І що навпаки можна сміливо відкласти на потім?":"Какие 3–5 функций обязательны для первой версии — без них продукт не имеет смысла? И что наоборот можно смело отложить на потом?",
"Покажіть продукти, додатки чи сайти, які вам подобаються — і скажіть, що саме чіпляє (зручність, стиль, конкретна функція). Додайте посилання, відео-огляди або запис екрана.":"Покажите продукты, приложения или сайты, которые вам нравятся — и скажите, что именно цепляет (удобство, стиль, конкретная функция). Добавьте ссылки, видеообзоры или запись экрана.",
"Який характер і настрій у продукту — діловий, дружній, преміальний, грайливий? Які кольори чи візуал вам близькі? Запишіть голосом свої побажання до дизайну й обовʼязково додайте посилання на референси.":"Какой характер и настроение у продукта — деловой, дружелюбный, премиальный, игривый? Какие цвета или визуал вам близки? Запишите голосом свои пожелания к дизайну и обязательно добавьте ссылки на референсы.",
"Як продукт заробляє або зароблятиме — підписка, разова оплата, комісія, реклама? Хто і скільки приблизно платить? Якщо ще не вирішили — опишіть варіанти, які розглядаєте.":"Как продукт зарабатывает или будет зарабатывать — подписка, разовая оплата, комиссия, реклама? Кто и сколько примерно платит? Если ещё не решили — опишите варианты, которые рассматриваете.",
"Як ви зрозумієте, що прототип вдалий — які цифри чи реакція людей це покажуть? Кому плануєте показати першим: інвесторам, аудиторії чи першим клієнтам?":"Как вы поймёте, что прототип удался — какие цифры или реакция людей это покажут? Кому планируете показать первым: инвесторам, аудитории или первым клиентам?",
"Якщо є дослідження, статті чи дані, що підтверджують проблему — додайте посилання.":"Если есть исследования, статьи или данные, подтверждающие проблему — добавьте ссылку.",
"Якщо ви вже описали цільову аудиторію (портрет користувача, дослідження) — додайте посилання на документ.":"Если вы уже описали целевую аудиторию (портрет пользователя, исследование) — добавьте ссылку на документ.",
"Посилання на конкурентів або рішення, якими люди користуються зараз.":"Ссылки на конкурентов или решения, которыми люди пользуются сейчас.",
"Якщо є презентація, лендинг чи опис продукту — додайте посилання.":"Если есть презентация, лендинг или описание продукта — добавьте ссылку.",
"Якщо є приклад подібного флоу, демо чи запис екрана — додайте посилання.":"Если есть пример похожего флоу, демо или запись экрана — добавьте ссылку.",
"Якщо є список функцій, бек-лог чи roadmap — додайте посилання.":"Если есть список функций, бэклог или roadmap — добавьте ссылку.",
"Посилання на продукти/інтерфейси, що подобаються, відео-огляди або Loom.":"Ссылки на продукты/интерфейсы, которые нравятся, видеообзоры или Loom.",
"Референси дизайну, мудборд, бренд-гайд або посилання з Aura.":"Референсы дизайна, мудборд, бренд-гайд или ссылка из Aura.",
"Якщо є фінмодель, прайсинг чи приклади монетизації — додайте посилання.":"Если есть финмодель, прайсинг или примеры монетизации — добавьте ссылку.",
"Якщо є метрики, цілі чи матеріали для інвесторів — додайте посилання.":"Если есть метрики, цели или материалы для инвесторов — добавьте ссылку.",
"Відкрити Aura":"Открыть Aura",
"Відео":"Видео",
"На Aura зібрані різні дизайн-системи продуктів. Знайдіть ту, що подобається найбільше, відкрийте її, скопіюйте посилання — і вставте нижче. Це допоможе нам зрозуміти ваші смаки.":"На Aura собраны разные дизайн-системы продуктов. Найдите ту, что нравится больше всего, откройте её, скопируйте ссылку — и вставьте ниже. Это поможет нам понять ваши вкусы."
};
    function t(s) { return (LANG === 'ru' && RU[s] != null) ? RU[s] : s; }
    function tf(s) { var a = arguments; return t(s).replace(/\{(\d+)\}/g, function (_, i) { return a[(+i) + 1]; }); }
    var PLURALS = {
        'запис': { uk: ['запис', 'записи', 'записів'], ru: ['запись', 'записи', 'записей'] },
        'посилання': { uk: ['посилання', 'посилання', 'посилань'], ru: ['ссылка', 'ссылки', 'ссылок'] }
    };
    function pl(n, key) { var f = (PLURALS[key] && PLURALS[key][LANG]) || PLURALS[key].uk; var d = n % 10, h = n % 100; if (d === 1 && h !== 11) return f[0]; if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return f[1]; return f[2]; }
    var CONTACTS = {};       // hydrated from backend (source of truth)
    var SUBMITTED = false;   // hydrated from backend
    function getContacts() { return CONTACTS; }
    function saveContacts(c) { CONTACTS = c || {}; }
    function contactsDone() { return !!(CONTACTS.name && (CONTACTS.email || CONTACTS.phone || CONTACTS.socials)); }
    function markSubmitted() { SUBMITTED = true; }
    function submittedAt() { return SUBMITTED; }

    /* ---------- Questions ---------- */
    var QUESTIONS = [
        { n: 1,  title: 'Проблема та її актуальність',
          help: 'Яку проблему вирішує ваш продукт і чому вона важлива? Що зараз незручно, повільно або дорого для ваших користувачів? Наприклад: «люди витрачають години на пошук…» або «бізнес втрачає клієнтів, бо…».',
          formats: ['voice'], linkHint: 'Якщо є дослідження, статті чи дані, що підтверджують проблему — додайте посилання.' },
        { n: 2,  title: 'Для кого це',
          help: 'Хто ваш головний користувач? Опишіть конкретну людину: вік, рід занять, ситуація. Коли й де вона скористається продуктом? Наприклад: «підприємець-початківець, який щойно відкрив магазин».',
          formats: ['voice'], linkHint: 'Якщо ви вже описали цільову аудиторію (портрет користувача, дослідження) — додайте посилання на документ.' },
        { n: 3,  title: 'Як вирішують зараз',
          help: 'Як люди вирішують це завдання зараз — інші додатки, Excel, вручну чи ніяк? Що в цих способах не влаштовує і чим ви будете кращими? Додайте посилання на конкурентів, якщо є.',
          formats: ['voice', 'links'], linkHint: 'Посилання на конкурентів або рішення, якими люди користуються зараз.' },
        { n: 4,  title: 'Суть і головна цінність',
          help: 'Опишіть продукт простими словами, ніби розповідаєте другу. Що людина зможе зробити і що отримає в результаті? Наприклад: «застосунок, де за 2 хвилини можна…».',
          formats: ['voice'], linkHint: 'Якщо є презентація, лендинг чи опис продукту — додайте посилання.' },
        { n: 5,  title: 'Перший «вау»-сценарій',
          help: 'Уявіть, що людина вперше відкрила продукт. Проведіть нас кроками: що вона бачить, що натискає і в який момент думає «о, це справді корисно»?',
          formats: ['voice'], linkHint: 'Якщо є приклад подібного флоу, демо чи запис екрана — додайте посилання.' },
        { n: 6,  title: 'Функції першої версії',
          help: 'Які 3–5 функцій обовʼязкові для першої версії — без них продукт не має сенсу? І що навпаки можна сміливо відкласти на потім?',
          formats: ['voice'], linkHint: 'Якщо є список функцій, бек-лог чи roadmap — додайте посилання.' },
        { n: 7,  title: 'Референси та конкуренти',
          help: 'Покажіть продукти, додатки чи сайти, які вам подобаються — і скажіть, що саме чіпляє (зручність, стиль, конкретна функція). Додайте посилання, відео-огляди або запис екрана.',
          formats: ['links', 'video', 'voice'], linkHint: 'Посилання на продукти/інтерфейси, що подобаються, відео-огляди або Loom.' },
        { n: 8,  title: 'Бренд, тон і стиль',
          help: 'Який характер і настрій у продукту — діловий, дружній, преміальний, грайливий? Які кольори чи візуал вам близькі? Запишіть голосом свої побажання до дизайну й обовʼязково додайте посилання на референси.',
          formats: ['voice', 'links'], linkHint: 'Референси дизайну, мудборд, бренд-гайд або посилання з Aura.',
          hint: { url: 'https://www.aura.build/design-systems', label: 'Відкрити Aura',
                  text: 'На Aura зібрані різні дизайн-системи продуктів. Знайдіть ту, що подобається найбільше, відкрийте її, скопіюйте посилання — і вставте нижче. Це допоможе нам зрозуміти ваші смаки.' } },
        { n: 9,  title: 'Монетизація',
          help: 'Як продукт заробляє або зароблятиме — підписка, разова оплата, комісія, реклама? Хто і скільки приблизно платить? Якщо ще не вирішили — опишіть варіанти, які розглядаєте.',
          formats: ['voice'], linkHint: 'Якщо є фінмодель, прайсинг чи приклади монетизації — додайте посилання.' },
        { n: 10, title: 'Успіх і наступний крок',
          help: 'Як ви зрозумієте, що прототип вдалий — які цифри чи реакція людей це покажуть? Кому плануєте показати першим: інвесторам, аудиторії чи першим клієнтам?',
          formats: ['voice', 'video'], linkHint: 'Якщо є метрики, цілі чи матеріали для інвесторів — додайте посилання.' }
    ];
    var FORMAT_META = {
        voice: { label: 'Голос', icon: 'solar:microphone-3-linear' },
        links: { label: 'Посилання', icon: 'solar:link-linear' },
        video: { label: 'Відео', icon: 'solar:videocamera-record-linear' }
    };
    var COUNTRY_CODES = [
        { f: '🇺🇦', c: '+380' }, { f: '🇵🇱', c: '+48' }, { f: '🇩🇪', c: '+49' }, { f: '🇬🇧', c: '+44' }, { f: '🇺🇸', c: '+1' },
        { f: '🇫🇷', c: '+33' }, { f: '🇪🇸', c: '+34' }, { f: '🇮🇹', c: '+39' }, { f: '🇳🇱', c: '+31' }, { f: '🇨🇿', c: '+420' },
        { f: '🇸🇰', c: '+421' }, { f: '🇷🇴', c: '+40' }, { f: '🇲🇩', c: '+373' }, { f: '🇱🇹', c: '+370' }, { f: '🇱🇻', c: '+371' },
        { f: '🇪🇪', c: '+372' }, { f: '🇬🇪', c: '+995' }, { f: '🇰🇿', c: '+7' }, { f: '🇹🇷', c: '+90' }, { f: '🇦🇪', c: '+971' },
        { f: '🇮🇱', c: '+972' }, { f: '🇨🇭', c: '+41' }, { f: '🇦🇹', c: '+43' }, { f: '🇧🇪', c: '+32' }, { f: '🇸🇪', c: '+46' },
        { f: '🇳🇴', c: '+47' }, { f: '🇩🇰', c: '+45' }, { f: '🇫🇮', c: '+358' }, { f: '🇮🇪', c: '+353' }, { f: '🇵🇹', c: '+351' },
        { f: '🇬🇷', c: '+30' }, { f: '🇧🇬', c: '+359' }, { f: '🇭🇺', c: '+36' }, { f: '🇭🇷', c: '+385' }, { f: '🇨🇦', c: '+1' },
        { f: '🇦🇺', c: '+61' }, { f: '🇮🇳', c: '+91' }, { f: '🇯🇵', c: '+81' }, { f: '🇧🇷', c: '+55' }, { f: '🇸🇦', c: '+966' }
    ];

    /* ---------- tiny utils ---------- */
    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function fmtTime(sec) {
        sec = Math.max(0, Math.round(sec));
        var m = Math.floor(sec / 60), s = sec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }
    function plural(n, one, few, many) {
        var d = n % 10, h = n % 100;
        if (d === 1 && h !== 11) return one;
        if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
        return many;
    }
    function prettyUrl(u) {
        try { var x = new URL(u); return x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname : ''); }
        catch (e) { return u; }
    }
    function normalizeUrl(u) {
        u = (u || '').trim();
        if (!u) return '';
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        try { new URL(u); return u; } catch (e) { return ''; }
    }
    function haptic(type) {
        if (!tg || !tg.HapticFeedback) return;
        tgCall(function () {
            if (type === 'impact') tg.HapticFeedback.impactOccurred('medium');
            else if (type === 'ok') tg.HapticFeedback.notificationOccurred('success');
            else tg.HapticFeedback.selectionChanged();
        });
    }
    var toastTimer;
    function toast(msg) {
        var t = $('#toast'); if (!t) return;
        t.textContent = msg; t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
    }

    /* ============================================================
       Store — IndexedDB persistence (one record per question).
       ============================================================ */
    var Store = (function () {
        var DB_NAME = 'gelato_brief';
        var STORE = 'answers';
        var dbp = null;
        function open() {
            if (dbp) return dbp;
            dbp = new Promise(function (res, rej) {
                var r = indexedDB.open(DB_NAME, 1);
                r.onupgradeneeded = function (e) {
                    var db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
                };
                r.onsuccess = function () { res(r.result); };
                r.onerror = function () { rej(r.error); };
            });
            return dbp;
        }
        function tx(mode) { return open().then(function (db) { return db.transaction(STORE, mode).objectStore(STORE); }); }
        return {
            getAll: function () {
                return tx('readonly').then(function (os) {
                    return new Promise(function (res, rej) {
                        var out = {}; var c = os.openCursor();
                        c.onsuccess = function (e) {
                            var cur = e.target.result;
                            if (cur) { out[cur.value.id] = cur.value; cur.continue(); }
                            else res(out);
                        };
                        c.onerror = function () { rej(c.error); };
                    });
                });
            },
            put: function (rec) {
                rec.ts = Date.now();
                return tx('readwrite').then(function (os) {
                    return new Promise(function (res, rej) {
                        var r = os.put(rec); r.onsuccess = function () { res(rec); }; r.onerror = function () { rej(r.error); };
                    });
                });
            }
        };
    })();

    /* ============================================================
       Sync — best-effort push of answers to the Supabase backend.
       Enabled only inside Telegram (needs initData) with config set;
       otherwise the app stays local-only (IndexedDB) as before.
       ============================================================ */
    var Sync = (function () {
        var CFG = window.GELATO_SUPABASE || {};
        var client = (CFG.url && CFG.anonKey && window.supabase) ? window.supabase.createClient(CFG.url, CFG.anonKey) : null;
        var enabled = !!(client && tg && tg.initData);
        function call(action, payload) {
            return client.functions.invoke('save', { body: Object.assign({ initData: tg.initData, action: action }, payload || {}) })
                .then(function (res) { if (res.error) throw res.error; return res.data; });
        }
        function extOf(mime) {
            mime = mime || '';
            if (mime.indexOf('mp4') > -1) return 'mp4';
            if (mime.indexOf('ogg') > -1) return 'ogg';
            if (mime.indexOf('mpeg') > -1 || mime.indexOf('mp3') > -1) return 'mp3';
            if (mime.indexOf('wav') > -1) return 'wav';
            return 'webm';
        }
        return {
            enabled: enabled,
            uploadVoice: function (n, title, clip) {
                return call('requestUpload', { qNum: n, title: title, ext: extOf(clip.mime), mime: clip.mime })
                    .then(function (up) {
                        return client.storage.from('voices').uploadToSignedUrl(up.path, up.token, clip.blob)
                            .then(function (r) { if (r.error) throw r.error; return up.path; });
                    })
                    .then(function (path) { return call('recordVoice', { qNum: n, title: title, path: path, mime: clip.mime, duration: clip.dur }); })
                    .then(function (rec) { return rec.id; });
            },
            deleteVoice: function (rid) { return call('deleteVoice', { id: rid }); },
            saveLink: function (n, title, url, kind) { return call('saveLink', { qNum: n, title: title, url: url, kind: kind }).then(function (r) { return r.id; }); },
            deleteLink: function (rid) { return call('deleteLink', { id: rid }); },
            saveContact: function (c) { return call('saveContact', { contact: c }); },
            getBrief: function () { return call('getBrief', {}); },
            submit: function (isUpdate) { return call('submit', { update: !!isUpdate }); }
        };
    })();

    function qMeta(qid) { var n = parseInt(qid.slice(1), 10); if (n === 0) return { n: 0, title: t('Опис продукту') }; return { n: n, title: (QUESTIONS[n - 1] || {}).title || '' }; }
    function syncVoice(qid, clip) {
        if (!Sync.enabled) return;
        var m = qMeta(qid);
        Sync.uploadVoice(m.n, m.title, clip).then(function (rid) { clip.remoteId = rid; persist(qid); }).catch(function () {});
    }

    /* ---------- in-memory mirror for synchronous rendering ---------- */
    var ANS = {};
    function ansFor(qid) {
        if (!ANS[qid]) ANS[qid] = { id: qid, voices: [], links: [] };
        return ANS[qid];
    }
    function persist(qid) { /* backend is the source of truth — nothing stored locally */ }
    function isAnswered(qid) { var a = ANS[qid]; return !!(a && (a.voices.length || a.links.length)); }
    function answeredCount() {
        return QUESTIONS.reduce(function (n, q) { return n + (isAnswered('q' + q.n) ? 1 : 0); }, 0);
    }

    /* ============================================================
       State + navigation.  pos: -1 intro | 0..9 questions | 10 review | 11 done
       ============================================================ */
    var state = { pos: -1 };
    var app = $('#app');
    var bar = $('#bar');
    function setBar(html) { bar.innerHTML = html ? '<div class="bar-inner">' + html + '</div>' : ''; }

    function setBackButton() {
        if (!tg || !tg.BackButton) return;
        var show = state.pos === 'contact' || (state.pos >= 0 && state.pos <= 10);
        if (show) tgCall(function () { tg.BackButton.show(); });
        else tgCall(function () { tg.BackButton.hide(); });
    }
    if (tg && tg.BackButton) tgCall(function () { tg.BackButton.onClick(function () { goBack(); }); });

    function goBack() {
        stopRecording(true);
        if (state.pos === 'contact') { state.pos = -1; render(); return; }
        if (state.pos === 'overview') return; // first content step — no way back to contacts
        if (state.pos === 0) { state.pos = 'overview'; render(); return; }
        if (state.pos >= 1 && state.pos <= 10) { state.pos -= 1; render(); }
    }
    function goTo(pos) { stopRecording(true); state.pos = pos; window.scrollTo(0, 0); render(); }

    // language toggle (top chrome) — re-renders in the chosen language
    document.addEventListener('click', function (e) {
        var b = (e.target && e.target.closest) ? e.target.closest('[data-lang]') : null;
        if (!b) return;
        var l = b.getAttribute('data-lang');
        if (l === LANG) return;
        LANG = l;
        try { localStorage.setItem('gelatoLang', l); } catch (err) {}
        try { document.documentElement.lang = l; } catch (err) {}
        render();
    });

    /* ============================================================
       Audio recording controller
       ============================================================ */
    var rec = { mr: null, chunks: [], stream: null, qid: null, t0: 0, int: null, active: false, _discard: false };

    function pickMime() {
        if (!window.MediaRecorder) return null;
        var cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', ''];
        for (var i = 0; i < cands.length; i++) {
            try { if (cands[i] === '' || MediaRecorder.isTypeSupported(cands[i])) return cands[i]; } catch (e) {}
        }
        return '';
    }

    function startRecording(qid) {
        if (rec.active) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
            toast(t('Запис не підтримується — завантажте аудіофайл')); return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            var mime = pickMime();
            try { rec.mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
            catch (e) { rec.mr = new MediaRecorder(stream); }
            rec.stream = stream; rec.chunks = []; rec.qid = qid; rec.active = true; rec.t0 = Date.now();
            rec.mr.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
            rec.mr.onstop = function () { finalizeRecording(); };
            rec.mr.start();
            haptic('impact');
            setRecState();
            tickRec();
            rec.int = setInterval(tickRec, 250);
        }).catch(function () {
            toast(t('Немає доступу до мікрофона'));
        });
    }

    function stopRecording(discard) {
        if (!rec.active) return;
        rec._discard = !!discard;
        clearInterval(rec.int); rec.int = null;
        try { rec.mr.stop(); } catch (e) { finalizeRecording(); }
    }

    function finalizeRecording() {
        var discard = rec._discard; rec._discard = false;
        if (rec.stream) { rec.stream.getTracks().forEach(function (t) { t.stop(); }); }
        var qid = rec.qid, chunks = rec.chunks, dur = (Date.now() - rec.t0) / 1000;
        rec.active = false; rec.mr = null; rec.stream = null; rec.chunks = []; rec.qid = null;
        if (discard || !chunks.length) { setRecState(); return; }
        var type = (chunks[0] && chunks[0].type) || 'audio/webm';
        var blob = new Blob(chunks, { type: type });
        if (blob.size < 600) { toast(t('Запис надто короткий')); setRecState(); return; }
        var a = ansFor(qid);
        var clip = { id: uid(), blob: blob, mime: type, dur: dur, ts: Date.now() };
        a.voices.push(clip);
        persist(qid);
        syncVoice(qid, clip);
        haptic('ok');
        if ((state.pos === 'overview' && qid === 'q0') || (state.pos >= 0 && state.pos <= 9 && 'q' + QUESTIONS[state.pos].n === qid)) render();
    }

    // sets the button icon/classes ONCE per state change (no re-render on the timer tick → no flicker)
    function setRecState() {
        var btn = $('#recBtn'), hint = $('#recHint'), wrap = $('#recWrap');
        if (!btn) return;
        if (rec.active) {
            btn.classList.add('is-rec');
            btn.innerHTML = '<iconify-icon icon="solar:stop-bold"></iconify-icon>';
            if (wrap) wrap.classList.add('live');
            if (hint) hint.classList.add('live');
        } else {
            btn.classList.remove('is-rec');
            btn.innerHTML = '<iconify-icon icon="solar:microphone-3-bold"></iconify-icon>';
            if (wrap) wrap.classList.remove('live');
            if (hint) { hint.classList.remove('live'); hint.textContent = t('Натисніть, щоб записати голосову'); }
        }
    }
    // updates ONLY the timer text on the interval
    function tickRec() {
        var hint = $('#recHint');
        if (hint && rec.active) hint.textContent = t('● Запис…') + ' ' + fmtTime((Date.now() - rec.t0) / 1000);
    }

    /* ---------- playback (single shared <audio>) ---------- */
    var player = $('#player');
    var playingId = null, playingUrl = null;
    function togglePlay(qid, clipId) {
        var a = ANS[qid]; if (!a) return;
        var clip = a.voices.filter(function (v) { return v.id === clipId; })[0]; if (!clip) return;
        if (playingId === clipId && !player.paused) { player.pause(); return; }
        if (playingUrl) { URL.revokeObjectURL(playingUrl); playingUrl = null; }
        if (clip.blob) { playingUrl = URL.createObjectURL(clip.blob); player.src = playingUrl; }
        else if (clip.url) { player.src = clip.url; }
        else { toast(t('Аудіо недоступне')); return; }
        playingId = clipId;
        player.play().catch(function () { toast(t('Не вдалося відтворити')); });
    }
    player.addEventListener('play', updatePlayIcons);
    player.addEventListener('pause', updatePlayIcons);
    player.addEventListener('ended', function () { playingId = null; updatePlayIcons(); });
    function updatePlayIcons() {
        document.querySelectorAll('[data-play]').forEach(function (b) {
            var on = (b.getAttribute('data-clip') === playingId) && !player.paused;
            var ic = b.querySelector('iconify-icon');
            if (ic) ic.setAttribute('icon', on ? 'solar:pause-bold' : 'solar:play-bold');
        });
    }

    /* ---------- mutations ---------- */
    function deleteVoice(qid, clipId) {
        var a = ANS[qid]; if (!a) return;
        var clip = a.voices.filter(function (v) { return v.id === clipId; })[0];
        if (playingId === clipId) { player.pause(); playingId = null; }
        a.voices = a.voices.filter(function (v) { return v.id !== clipId; });
        persist(qid);
        if (clip && clip.remoteId && Sync.enabled) Sync.deleteVoice(clip.remoteId).catch(function () {});
        render();
    }
    function deleteLink(qid, linkId) {
        var a = ANS[qid]; if (!a) return;
        var link = a.links.filter(function (l) { return l.id === linkId; })[0];
        a.links = a.links.filter(function (l) { return l.id !== linkId; });
        persist(qid);
        if (link && link.remoteId && Sync.enabled) Sync.deleteLink(link.remoteId).catch(function () {});
        render();
    }
    function addLink(qid, raw, kind) {
        var url = normalizeUrl(raw);
        if (!url) { toast(t('Перевірте посилання')); return false; }
        var link = { id: uid(), url: url, kind: kind || 'link', ts: Date.now() };
        ansFor(qid).links.push(link);
        persist(qid);
        if (Sync.enabled) { var m = qMeta(qid); Sync.saveLink(m.n, m.title, link.url, link.kind).then(function (id) { link.remoteId = id; persist(qid); }).catch(function () {}); }
        haptic(); render();
        return true;
    }

    /* ============================================================
       Rendering
       ============================================================ */
    function topChrome(label) {
        var total = QUESTIONS.length, done = answeredCount();
        var pct = state.pos >= 0 && state.pos <= 9
            ? Math.round((state.pos / total) * 100)
            : Math.round((done / total) * 100);
        return '' +
            '<div class="top">' +
                '<div class="step-count">' + label + '</div>' +
                '<div class="lang-toggle">' +
                    '<button type="button" data-lang="uk"' + (LANG === 'uk' ? ' class="on"' : '') + '>UA</button>' +
                    '<button type="button" data-lang="ru"' + (LANG === 'ru' ? ' class="on"' : '') + '>RU</button>' +
                '</div>' +
            '</div>' +
            '<div class="pbar"><i style="width:' + pct + '%"></i></div>';
    }

    function render() {
        setBackButton();
        if (state.pos === 'contact') return renderContact();
        if (state.pos === 'overview') return renderOverview();
        if (state.pos === -1) return renderIntro();
        if (state.pos >= 0 && state.pos <= 9) return renderQuestion(state.pos);
        if (state.pos === 10) return renderReview();
        return renderDone();
    }

    function feat(icon, t, d) {
        return '<div class="feat"><div class="fi"><iconify-icon icon="' + icon + '"></iconify-icon></div>' +
               '<div class="ft"><b>' + t + '</b>' + d + '</div></div>';
    }

    function renderIntro() {
        var done = answeredCount();
        var resuming = done > 0;
        var hi = tgUser && tgUser.first_name ? (', ' + esc(tgUser.first_name)) : '';
        app.innerHTML =
            topChrome(t('Бриф')) +
            '<div class="card">' +
                '<div class="eyebrow">' + t('Інтерактивний бриф · ~10–15 хв') + '</div>' +
                '<h1 class="title">' + t('Розкажіть про ідею') + hi + '</h1>' +
                '<p class="help">' + t('10 коротких питань, щоб ми зрозуміли ваш продукт ще до стратегічної сесії. Відповідайте, як зручно — голосом, посиланнями чи відео.') + '</p>' +
                '<div class="intro-feats">' +
                    feat('solar:microphone-3-linear', t('Голосом'), t('На кожне питання — одна чи кілька голосових. Можна прослухати й перезаписати.')) +
                    feat('solar:link-linear', t('Посилання та відео'), t('Кидайте конкурентів, референси, огляди чи Loom — усе в одному місці.')) +
                    feat('solar:diskette-linear', t('Зберігається саме'), t('Можна вийти й повернутись будь-коли — відповіді лишаться на вашому акаунті.')) +
                '</div>' +
            '</div>';
        setBar(resuming
            ? '<button class="btn btn-ghost" id="reviewBtn">' + t('Огляд') + '</button><button class="btn btn-primary" id="startBtn"><iconify-icon icon="solar:play-circle-bold"></iconify-icon> ' + tf('Продовжити · {0}/10', done) + '</button>'
            : '<button class="btn btn-primary" id="startBtn">' + t('Розпочати') + ' <iconify-icon icon="solar:arrow-right-linear"></iconify-icon></button>');
        $('#startBtn').onclick = function () {
            var first = 0;
            for (var i = 0; i < QUESTIONS.length; i++) { if (!isAnswered('q' + QUESTIONS[i].n)) { first = i; break; } }
            if (!contactsDone()) { goTo('contact'); return; }
            goTo(resuming ? first : 0);
        };
        if ($('#reviewBtn')) $('#reviewBtn').onclick = function () { goTo(10); };
    }

    function renderContact() {
        var c = getContacts();
        var defName = c.name || (tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') : '');
        var tgLine = (tgUser && tgUser.username)
            ? '<div class="tg-chip"><iconify-icon icon="solar:chat-round-line-linear"></iconify-icon> Telegram: @' + esc(tgUser.username) + '</div>'
            : '';
        var codeOpts = COUNTRY_CODES.map(function (cc) { return '<option value="' + cc.c + '">' + cc.f + ' ' + cc.c + '</option>'; }).join('');
        app.innerHTML =
            topChrome(t('Контакти')) +
            '<div class="card">' +
                '<div class="eyebrow">' + t('Перед початком') + '</div>' +
                '<h2 class="qtitle">' + t('Ваші контакти') + '</h2>' +
                '<p class="help">' + t('Лишіть контакти, щоб ми могли звʼязатися щодо стратегічної сесії.') + '</p>' +
                tgLine +
                '<div class="field"><label>' + t('Імʼя') + ' <span class="req">*</span></label><input id="cName" type="text" value="' + esc(defName) + '" placeholder="' + t('Як до вас звертатися') + '"></div>' +
                '<div class="field"><label>Email <span class="req">*</span></label><input id="cEmail" type="email" inputmode="email" value="' + esc(c.email || '') + '" placeholder="you@example.com"></div>' +
                '<div class="field"><label>' + t('Телефон') + ' <span class="req">*</span></label><div class="phone-row"><select id="cCode" class="phone-code">' + codeOpts + '</select><input id="cPhone" type="tel" inputmode="tel" placeholder="' + t('номер телефону') + '"></div></div>' +
                '<div class="field"><label>' + t('Соцмережі') + '</label><input id="cSocials" type="text" value="' + esc(c.socials || '@') + '" placeholder="' + t('напишіть нік') + '"></div>' +
                '<p class="help" style="font-size:12px;margin-top:14px">' + t('Обовʼязково: імʼя, email і телефон. Соцмережі — за бажанням.') + '</p>' +
            '</div>';
        setBar('<button class="btn btn-primary" id="cNext">' + t('Перейти до питань') + ' <iconify-icon icon="solar:arrow-right-linear"></iconify-icon></button>');
        var codeSel = $('#cCode'), phoneInp = $('#cPhone');
        if (c.phone) {
            var matched = '';
            for (var k = 0; k < COUNTRY_CODES.length; k++) { if (c.phone.indexOf(COUNTRY_CODES[k].c + ' ') === 0) { matched = COUNTRY_CODES[k].c; break; } }
            if (matched) { codeSel.value = matched; phoneInp.value = c.phone.slice(matched.length + 1); }
            else { phoneInp.value = c.phone; }
        }
        // keep the focused field visible when the keyboard opens
        ['cName', 'cEmail', 'cPhone', 'cSocials'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('focus', function () { setTimeout(function () { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 300); });
        });
        $('#cNext').onclick = function () {
            var pnat = phoneInp.value.trim();
            var soc = $('#cSocials').value.trim(); if (soc === '@') soc = '';
            var data = {
                name: $('#cName').value.trim(),
                email: $('#cEmail').value.trim(),
                phone: pnat ? (codeSel.value + ' ' + pnat) : '',
                socials: soc
            };
            if (!data.name) { toast(t('Вкажіть імʼя')); return; }
            if (!/.+@.+\..+/.test(data.email)) { toast(t('Вкажіть коректний email')); return; }
            if (!pnat) { toast(t('Вкажіть номер телефону')); return; }
            saveContacts(data);
            if (Sync.enabled) Sync.saveContact(data).catch(function () { toast(t('Не вдалося зберегти контакти — перевірте бекенд')); });
            haptic('ok');
            goTo('overview');
        };
    }

    function renderOverview() {
        var qid = 'q0', a = ansFor(qid);
        var voicesHtml = a.voices.length
            ? '<div class="list">' + a.voices.map(function (v, i) {
                return '<div class="row">' +
                    '<button class="icon-btn" data-play data-clip="' + v.id + '"><iconify-icon icon="solar:play-bold"></iconify-icon></button>' +
                    '<div class="meta"><span class="ln1">' + tf('Запис #{0}', i + 1) + '</span>' +
                    '<div class="ln2">' + fmtTime(v.dur || 0) + '</div></div>' +
                    '<button class="del" data-delvoice="' + v.id + '"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>' +
                '</div>';
            }).join('') + '</div>'
            : '';
        app.innerHTML =
            topChrome(t('Опис продукту')) +
            '<div class="card">' +
                '<div class="eyebrow">' + t('Почнімо з головного') + '</div>' +
                '<h2 class="qtitle">' + t('Розкажіть про продукт своїми словами') + '</h2>' +
                '<p class="help">' + t('Перед детальними питаннями просто опишіть голосом, про що ваш продукт і навіщо ви його робите — як відчуваєте самі, без деталізації. Можна одне чи кілька повідомлень, будь-якої довжини. Далі перейдемо до конкретних питань.') + '</p>' +
                '<div class="block">' +
                    '<div class="block-label"><iconify-icon icon="solar:microphone-3-linear"></iconify-icon>' + t('Голосовий опис') + '</div>' +
                    '<div class="rec-wrap" id="recWrap">' +
                        '<button class="rec" id="recBtn"><iconify-icon icon="solar:microphone-3-bold"></iconify-icon></button>' +
                        '<div class="eq"><i></i><i></i><i></i><i></i><i></i></div>' +
                        '<div class="rec-hint" id="recHint">' + t('Натисніть, щоб записати голосову') + '</div>' +
                    '</div>' +
                    voicesHtml +
                '</div>' +
            '</div>';
        setBar(
            '<button class="btn btn-ghost narrow" id="goReview"><iconify-icon icon="solar:checklist-minimalistic-linear"></iconify-icon> ' + t('Огляд') + '</button>' +
            '<button class="btn btn-primary" id="ovNext">' + t('До питань') + ' <iconify-icon icon="solar:arrow-right-linear"></iconify-icon></button>'
        );
        setRecState();
        $('#recBtn').onclick = function () { if (rec.active) stopRecording(false); else startRecording(qid); };
        document.querySelectorAll('[data-play]').forEach(function (b) { b.onclick = function () { togglePlay(qid, b.getAttribute('data-clip')); }; });
        document.querySelectorAll('[data-delvoice]').forEach(function (b) { b.onclick = function () { deleteVoice(qid, b.getAttribute('data-delvoice')); }; });
        $('#goReview').onclick = function () { goTo(10); };
        $('#ovNext').onclick = function () { goTo(0); };
    }

    function renderQuestion(idx) {
        var q = QUESTIONS[idx], qid = 'q' + q.n, a = ansFor(qid);
        var wantsVideo = q.formats.indexOf('video') > -1;

        var voicesHtml = a.voices.length
            ? '<div class="list">' + a.voices.map(function (v, i) {
                return '<div class="row">' +
                    '<button class="icon-btn" data-play data-clip="' + v.id + '"><iconify-icon icon="solar:play-bold"></iconify-icon></button>' +
                    '<div class="meta"><span class="ln1">' + tf('Запис #{0}', i + 1) + '</span>' +
                    '<div class="ln2">' + fmtTime(v.dur || 0) + '</div></div>' +
                    '<button class="del" data-delvoice="' + v.id + '"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>' +
                '</div>';
            }).join('') + '</div>'
            : '';

        var linksHtml = a.links.length
            ? '<div class="list">' + a.links.map(function (l) {
                var ic = l.kind === 'video' ? 'solar:videocamera-record-linear' : 'solar:link-linear';
                return '<div class="row">' +
                    '<span class="icon-btn"><iconify-icon icon="' + ic + '"></iconify-icon></span>' +
                    '<div class="meta"><a class="ln1" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(prettyUrl(l.url)) + '</a></div>' +
                    '<button class="del" data-dellink="' + l.id + '"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>' +
                '</div>';
            }).join('') + '</div>'
            : '';

        var linkBlock =
            '<div class="block">' +
                '<div class="block-label"><iconify-icon icon="' + (wantsVideo ? 'solar:videocamera-record-linear' : 'solar:link-linear') + '"></iconify-icon>' +
                    (wantsVideo ? t('Посилання та відео') : t('Посилання')) + '</div>' +
                (q.linkHint ? '<p class="link-hint">' + esc(t(q.linkHint)) + '</p>' : '') +
                linksHtml +
                '<div class="adder">' +
                    '<input id="linkInput" type="url" inputmode="url" placeholder="' + t('Вставте посилання') + '">' +
                    '<button id="linkAdd"><iconify-icon icon="mdi:plus"></iconify-icon> ' + t('Додати') + '</button>' +
                '</div>' +
            '</div>';

        var hintHtml = q.hint ? (
            '<a class="hint" href="' + esc(q.hint.url) + '" target="_blank" rel="noopener">' +
                '<span class="hint-ic"><img class="hint-logo" src="aura.svg" alt="Aura"></span>' +
                '<span class="hint-body"><span class="hint-text">' + esc(t(q.hint.text)) + '</span>' +
                '<span class="hint-link">' + esc(t(q.hint.label)) + ' <iconify-icon icon="solar:arrow-right-up-linear"></iconify-icon></span></span>' +
            '</a>'
        ) : '';

        var last = idx === QUESTIONS.length - 1;
        app.innerHTML =
            topChrome(tf('Питання {0} з {1}', q.n, QUESTIONS.length)) +
            '<div class="card">' +
                '<div class="eyebrow"><span class="qnum">' + (q.n < 10 ? '0' + q.n : q.n) + '</span> · ' + t('Питання') + '</div>' +
                '<h2 class="qtitle">' + esc(t(q.title)) + '</h2>' +
                '<p class="help">' + esc(t(q.help)) + '</p>' +

                '<div class="block">' +
                    '<div class="block-label"><iconify-icon icon="solar:microphone-3-linear"></iconify-icon>' + t('Голосова відповідь') + '</div>' +
                    '<div class="rec-wrap" id="recWrap">' +
                        '<button class="rec" id="recBtn"><iconify-icon icon="solar:microphone-3-bold"></iconify-icon></button>' +
                        '<div class="eq"><i></i><i></i><i></i><i></i><i></i></div>' +
                        '<div class="rec-hint" id="recHint">' + t('Натисніть, щоб записати голосову') + '</div>' +
                    '</div>' +
                    voicesHtml +
                '</div>' +

                hintHtml +
                linkBlock +
            '</div>';

        setBar(
            '<button class="btn btn-ghost narrow" id="prevBtn"><iconify-icon icon="solar:arrow-left-linear"></iconify-icon></button>' +
            '<button class="btn btn-ghost narrow" id="goReview"><iconify-icon icon="solar:checklist-minimalistic-linear"></iconify-icon> ' + t('Огляд') + '</button>' +
            '<button class="btn btn-primary" id="nextBtn">' + (last ? t('До огляду') : t('Далі')) + ' <iconify-icon icon="solar:arrow-right-linear"></iconify-icon></button>'
        );

        setRecState();
        $('#recBtn').onclick = function () { if (rec.active) stopRecording(false); else startRecording(qid); };
        document.querySelectorAll('[data-play]').forEach(function (b) {
            b.onclick = function () { togglePlay(qid, b.getAttribute('data-clip')); };
        });
        document.querySelectorAll('[data-delvoice]').forEach(function (b) {
            b.onclick = function () { deleteVoice(qid, b.getAttribute('data-delvoice')); };
        });
        document.querySelectorAll('[data-dellink]').forEach(function (b) {
            b.onclick = function () { deleteLink(qid, b.getAttribute('data-dellink')); };
        });
        var inp = $('#linkInput');
        var doAdd = function () {
            var kind = /youtu\.?be|loom\.com|vimeo|\.mp4|\.mov/i.test(inp.value) ? 'video' : 'link';
            addLink(qid, inp.value, wantsVideo ? kind : 'link');
        };
        $('#linkAdd').onclick = doAdd;
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        var pv = document.getElementById('prevBtn'); if (pv) pv.onclick = function () { goTo(idx === 0 ? 'overview' : idx - 1); };
        $('#goReview').onclick = function () { goTo(10); };
        $('#nextBtn').onclick = function () { goTo(idx + 1 > 9 ? 10 : idx + 1); };
    }

    function renderReview() {
        var done = answeredCount();
        var total = QUESTIONS.length;
        var all = done === total;
        var sAt = submittedAt();
        var items = QUESTIONS.map(function (q, i) {
            var qid = 'q' + q.n, a = ansFor(qid), ok = isAnswered(qid);
            var bits = [];
            if (a.voices.length) bits.push(a.voices.length + ' ' + pl(a.voices.length, 'запис'));
            if (a.links.length) bits.push(a.links.length + ' ' + pl(a.links.length, 'посилання'));
            var sub = bits.length ? bits.join(' · ') : t('Ще не заповнено');
            return '<button class="rev-item" data-go="' + i + '">' +
                '<span class="rev-badge ' + (ok ? 'done' : 'todo') + '">' + (ok ? '<iconify-icon icon="mdi:check-bold" width="16"></iconify-icon>' : q.n) + '</span>' +
                '<span class="rev-main"><span class="rt">' + esc(t(q.title)) + '</span><span class="rs">' + sub + '</span></span>' +
                '<span class="go"><iconify-icon icon="solar:pen-2-linear"></iconify-icon></span>' +
            '</button>';
        }).join('');
        var ov = ansFor('q0'); var ovOk = ov.voices.length > 0;
        var ovSub = ov.voices.length ? (ov.voices.length + ' ' + pl(ov.voices.length, 'запис')) : t('Ще не заповнено');
        var ovItem = '<button class="rev-item" data-go="ov">' +
            '<span class="rev-badge ' + (ovOk ? 'done' : 'todo') + '">' + (ovOk ? '<iconify-icon icon="mdi:check-bold" width="16"></iconify-icon>' : '0') + '</span>' +
            '<span class="rev-main"><span class="rt">' + t('Опис продукту') + '</span><span class="rs">' + ovSub + '</span></span>' +
            '<span class="go"><iconify-icon icon="solar:pen-2-linear"></iconify-icon></span>' +
        '</button>';

        var headHtml = sAt
            ? ('<div class="done-banner">' +
                   '<div class="db-ic"><iconify-icon icon="mdi:check-bold"></iconify-icon></div>' +
                   '<div class="db-body"><div class="db-title">' + t('Бриф надіслано') + '</div>' +
                   '<p class="db-text">' + t('Дякуємо! Будь-які зміни, які ви додаєте далі — нові голосові чи посилання — ми отримуємо автоматично. Повторно надсилати нічого не потрібно.') + '</p></div>' +
               '</div>')
            : ('<div class="eyebrow">' + (all ? t('Майже готово') : t('Огляд')) + '</div>' +
               '<h2 class="qtitle">' + t('Перегляньте бриф') + '</h2>' +
               '<p class="help">' + (all ? t('Усе заповнено — можна надсилати бриф.') : tf('Заповнено {0} із {1}. Надіслати можна, коли заповните всі питання.', done, total)) + '</p>');

        app.innerHTML =
            topChrome(tf('Огляд · {0}/{1}', done, total)) +
            '<div class="card">' + headHtml + '<div class="rev-list">' + ovItem + items + '</div></div>';

        setBar((all && !sAt) ? '<button class="btn btn-primary" id="submitBtn">' + t('Надіслати бриф') + ' <iconify-icon icon="solar:plain-2-bold"></iconify-icon></button>' : '');
        document.querySelectorAll('[data-go]').forEach(function (it) { it.onclick = function () { var g = it.getAttribute('data-go'); goTo(g === 'ov' ? 'overview' : parseInt(g, 10)); }; });
        var sbtn = document.getElementById('submitBtn'); if (sbtn) sbtn.onclick = function () { submitBrief(); };
    }

    function renderDone() {
        app.innerHTML =
            '<div class="card"><div class="done-wrap">' +
                '<div class="done-ic"><iconify-icon icon="solar:check-read-linear"></iconify-icon></div>' +
                '<h2 class="qtitle" style="margin-top:0">' + t('Бриф надіслано') + '</h2>' +
                '<p class="help" style="margin-left:auto;margin-right:auto;max-width:34ch">' + t('Дякуємо за підтвердження! Ми вивчимо матеріали й підготуємось до стратегічної сесії. Будь-які зміни, які ви додасте далі, ми отримаємо автоматично — повторно надсилати не потрібно.') + '</p>' +
            '</div></div>';
        setBar('<button class="btn btn-ghost" id="reopen">' + t('Відкрити бриф знову') + '</button>');
        $('#reopen').onclick = function () { goTo(10); };
    }

    /* ============================================================
       Submit — v1 marks complete locally. TODO: POST to backend
       (validate Telegram initData, upload audio to storage, notify
       team). The collected payload is assembled here for that swap.
       ============================================================ */
    function submitBrief() {
        markSubmitted();
        if (Sync.enabled) Sync.submit().catch(function () {});
        haptic('ok');
        goTo(11);
    }

    /* ============================================================
       Boot
       ============================================================ */
    function hydrate(d) {
        if (d.contact && d.contact.name) CONTACTS = d.contact;
        SUBMITTED = d.status === 'submitted';
        (d.voices || []).forEach(function (v) {
            if (v.q == null) return;
            ansFor('q' + v.q).voices.push({ id: v.id, remoteId: v.id, url: v.url, dur: v.dur || 0, mime: v.mime, transcript: v.transcript });
        });
        (d.links || []).forEach(function (l) {
            if (l.q == null) return;
            ansFor('q' + l.q).links.push({ id: l.id, remoteId: l.id, url: l.url, kind: l.kind });
        });
    }

    function entryPos() {
        if (!contactsDone()) return -1; // new user -> intro -> contacts
        var any = isAnswered('q0');
        for (var i = 0; i < QUESTIONS.length; i++) { if (isAnswered('q' + QUESTIONS[i].n)) any = true; }
        if (!any) return 'overview'; // fresh after contacts -> product description first
        for (var j = 0; j < QUESTIONS.length; j++) { if (!isAnswered('q' + QUESTIONS[j].n)) return j; }
        return 10; // everything answered -> review
    }

    ansFor('q0');
    QUESTIONS.forEach(function (q) { ansFor('q' + q.n); });
    if (Sync.enabled) {
        app.innerHTML = '<div class="card" style="margin-top:24px"><p class="help">' + t('Завантаження брифу…') + '</p></div>';
        Sync.getBrief().then(function (d) { if (d && d.exists) hydrate(d); state.pos = entryPos(); render(); }).catch(function () { toast(t('Бриф не завантажився — перевірте функцію save')); state.pos = entryPos(); render(); });
    } else {
        state.pos = entryPos();
        render();
    }
})();
