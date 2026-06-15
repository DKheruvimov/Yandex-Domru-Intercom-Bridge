# Инструкция по деплою Шлюза Дом.ру — Яндекс через Cloud.ru Artifact Registry

Данный проект полностью настроен для автоматической сборки и публикации в вашем приватном реестре **Cloud.ru Artifact Registry** по адресу:
`dom-ru.cr.cloud.ru/domru-yandex-bridge:latest`

В репозитории **нет необходимости настраивать SSH-ключи, доступы к VPS или сторонние скрипты**. Деплой происходит по точно такой же схеме, как и в вашем рабочем проекте `kheruvimovy2`.

---

## 1. Настройки секретов в GitHub
Для того чтобы GitHub Actions мог успешно загружать собранные Docker-образы в ваш реестр, перейдите в настройки репозитория:
**Settings ➔ Secrets and variables ➔ Actions ➔ Repository secrets** и убедитесь, что у вас добавлены следующие два секрета:

1. `REGISTRY_USERNAME` — Ваше имя пользователя (Key ID) от Cloud.ru. Например: `f79341e4475e27f68bf0d81e78d88b3e` (активный ключ доступа).
2. `REGISTRY_PASSWORD` — Пароль вашего сервисного аккаунта или секретный ключ ключа доступа (Secret Key).

---

## 2. Как запустить контейнер на вашей VPS
Так как сборка и деплой образа происходят на стороне GitHub Actions и загружаются в `dom-ru.cr.cloud.ru`, на самом сервере вам нужно выполнить запуск контейнера всего один раз.

### Подключитесь по SSH к вашей VPS и выполните:

1. **Авторизуйтесь в реестре Cloud.ru на сервере:**
   ```bash
   docker login dom-ru.cr.cloud.ru -u f79341e4475e27f68bf0d81e78d88b3e
   ```
   *(Введите секретный пароль ключа доступа, когда Docker его запросит)*

2. **Загрузите (pull) последний образ шлюза:**
   ```bash
   docker pull dom-ru.cr.cloud.ru/domru-yandex-bridge:latest
   ```

3. **Запустите контейнер шлюза на свободном порту 3100 с надежной конфигурацией DNS:**
   Чтобы обойти возможные сбои локального DNS-сервера вашей VPS (которые приводят к ошибке `getaddrinfo ENOTFOUND ss-api.domru.ru`), мы явно передаем контейнеру надежные публичные DNS-сервера (Яндекс DNS и Google DNS) с помощью флагов `--dns`:
   ```bash
   docker run -d \
     --name domru-bridge \
     --restart always \
     --dns 77.88.8.8 \
     --dns 8.8.8.8 \
     -p 3100:3000 \
     dom-ru.cr.cloud.ru/domru-yandex-bridge:latest
   ```

---

### ⚠️ Важное предупреждение перед запуском Watchtower:
Перед запуском Watchtower обязательно выполните `docker login` (шаг 2.1). Если запустить Watchtower **до того**, как файл `/root/.docker/config.json` физически появится на вашем сервере, Docker автоматически создаст **директорию** с именем `config.json`. Это заблокирует авторизацию и вызовет ошибки `401 Unauthorized`.

---

## 3. Как настроить 100% Автоматическое обновление (CD) на VPS

Если вы столкнулись с ошибкой `read /root/.docker/config.json: is a directory`, выполните на сервере следующие команды **строго по очереди**:

```bash
# 1. Сначала СРАЗУ удаляем ошибочно созданную директорию config.json (это уберет все предупреждения от docker!)
sudo rm -rf /root/.docker/config.json

# 2. Создаем правильную структуру папок для Docker
sudo mkdir -p /root/.docker

# 3. Теперь останавливаем и удаляем старый watchtower (теперь без каких-либо предупреждений!)
sudo docker stop watchtower || true
sudo docker rm watchtower || true

# 4. Проходим авторизацию заново (это создаст правильный ФАЙЛ config.json вместо директории)
sudo docker login dom-ru.cr.cloud.ru -u f79341e4475e27f68bf0d81e78d88b3e

# 5. Проверяем, что теперь это именно файл с верифицированным логином (должно вывести текст json)
sudo cat /root/.docker/config.json

# 6. Скачиваем свежий образ вручную
sudo docker pull dom-ru.cr.cloud.ru/domru-yandex-bridge:latest

# 7. Перезапускаем наш контейнер шлюза с принудительным DNS (Яндекс и Google)
sudo docker stop domru-bridge || true
sudo docker rm domru-bridge || true
sudo docker run -d \
  --name domru-bridge \
  --restart always \
  --dns 77.88.8.8 \
  --dns 8.8.8.8 \
  -p 3100:3000 \
  dom-ru.cr.cloud.ru/domru-yandex-bridge:latest

# 8. Запускаем Watchtower (только теперь, когда файл config.json существует!)
sudo docker run -d \
  --name watchtower \
  --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /root/.docker/config.json:/config.json \
  containrrr/watchtower \
  --cleanup \
  --interval 300
```

### Как это работает:
* Раз в 5 минут (300 секунд) Watchtower обращается к вашему `dom-ru.cr.cloud.ru` используя авторизацию, сохраненную на шаге 2.1.
* Если на GitHub Actions собрался новый образ `:latest`, Watchtower аккуратно скачивает его, гасит старый контейнер `domru-bridge` и запускает его на том же порту `3100` с новым кодом.
* При работе Watchtower старые слои Docker автоматически удаляются (`--cleanup`), предотвращая переполнение диска VPS.

---

## 4. Настройка Nginx для уживания со старым проектом (kheruvimovy.ru)
Так как первый проект уже запущен на сервере, новый шлюз на порту `3100` будет работать полностью изолированно. Вам достаточно настроить Nginx на VPS для проксирования запросов.

Для создания файла конфигурации вам потребуются права суперпользователя (`sudo`), так как системные директории закрыты от обычной записи:

Создайте или добавьте файл конфигурации, выполнив:
```bash
sudo nano /etc/nginx/sites-available/kheruvimov.ru
```

Вставьте следующее содержимое:
```nginx
server {
    listen 80;
    server_name kheruvimov.ru www.kheruvimov.ru;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируйте конфигурацию и перезапустите Nginx (также используя `sudo`):
```bash
# Если ссылка уже существует (появится ошибка 'File exists'), это нормально — значит файл уже прилинкован.
sudo ln -s /etc/nginx/sites-available/kheruvimov.ru /etc/nginx/sites-enabled/

# Проверяем синтаксис конфигурации Nginx
sudo nginx -t

# Перезапускаем Nginx для применения изменений
sudo systemctl reload nginx
```

---

## 5. Установка SSL-сертификата (HTTPS) через Let's Encrypt (Certbot)

Чтобы шлюз работал по безопасному протоколу HTTPS (что **критически необходимо** для интеграции с Умным Домом Яндекса), нужно бесплатно получить SSL-сертификат с помощью **Certbot**.

### Пошаговая инструкция на VPS:

1. **Установите Certbot и плагин для Nginx:**
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx -y
   ```

2. **Получите и настройте SSL-сертификат:**
   Выполните команду, указав ваш домен (Certbot сам найдет нужную конфигурацию Nginx, выпустит сертификат и автоматически добавит настройки HTTPS в файл `/etc/nginx/sites-available/kheruvimov.ru`):
   ```bash
   sudo certbot --nginx -d kheruvimov.ru -d www.kheruvimov.ru
   ```
   *В процессе утилита попросит вас:*
   * Ввести вашу электронную почту (для уведомлений об окончании действия сертификата).
   * Согласиться с условиями использования (нажмите `Y` и Enter).
   * Спросит, делиться ли почтой (на ваше усмотрение `Y` или `N`).
   * **Важно:** Если спросит про автоматическое перенаправление (Redirect) с HTTP на HTTPS, выберите пункт со словом **Redirect** (обычно ввести цифру `2`), чтобы все запросы автоматически становились безопасными.

3. **Проверьте автоматическое продление сертифкатов:**
   Let's Encrypt сертификаты выдаются на 90 дней, но Certbot настраивает планировщик для их автоматического обновления. Проверить работоспособность автопродления можно командой:
   ```bash
   sudo certbot renew --dry-run
   ```
   Если ошибок нет, ваш сертификат будет автоматически обновляться вечно!

---

## 6. Решение возможных проблем с DNS (getaddrinfo ENOTFOUND ss-api.domru.ru)

Если в логах или веб-интерфейсе вашего шлюза отображается ошибка:
> *Не удалось связаться с серверами Дом.ру: fetch failed (Причина: getaddrinfo ENOTFOUND ss-api.domru.ru)*

### Почему это происходит:
Кусок сети Docker-моста по умолчанию наследует DNS-настройки вашей хост-системы VPS. Сетевые DNS-резолверы некоторых провайдеров в облаке Cloud.ru могут давать сбой или не разрешать внутренние поддомены ЭР-Телеком (Дом.ру), такие как `ss-api.domru.ru`.

### Как это исправить за 10 секунд:
Перезапустите контейнер шлюза с принудительным назначением быстрых публичных DNS-серверов Яндекса и Google с помощью параметров `--dns`:

```bash
# 1. Останавливаем старый контейнер
sudo docker stop domru-bridge || true
sudo docker rm domru-bridge || true

# 2. Запускаем заново с явным указанием DNS
sudo docker run -d \
  --name domru-bridge \
  --restart always \
  --dns 77.88.8.8 \
  --dns 8.8.8.8 \
  -p 3100:3000 \
  dom-ru.cr.cloud.ru/domru-yandex-bridge:latest
```

*(Watchtower автоматически сохраняет все переданные при запуске параметры (включая `--dns`), поэтому при будущих автодеплоях с GitHub настройки сохранятся!)*

Ваш шлюз теперь полностью доступен по безопасному адресу `https://kheruvimov.ru` и настроен для автодеплоя!
