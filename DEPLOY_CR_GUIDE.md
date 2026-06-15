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

3. **Запустите контейнер шлюза на свободном порту 3100:**
   ```bash
   docker run -d \
     --name domru-bridge \
     --restart always \
     -p 3100:3000 \
     dom-ru.cr.cloud.ru/domru-yandex-bridge:latest
   ```

---

## 3. Как настроить 100% Автоматическое обновление (CD) на VPS
Чтобы при каждом пуше в Github и обновлении образа на Artifact Registry ваш сервер **автоматически** скачивал новую версию и перезапускал её (без ручного ввода команд), используйте инструмент **Watchtower**.

Это легковесная и безопасная утилита, которая не требует SSH-ключей в GitHub:

Выполните на сервере VPS следующую команду один раз:
```bash
docker run -d \
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
Так как первый проект уже запущен на сервере, новый шлюз на порту `3100` будет работать полностью изолированно. Вам достаточно настроить Nginx на VPS для проксирования запросов:

Создайте или добавьте в `/etc/nginx/sites-available/kheruvimov.ru` (ваш новый домен):
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

Активируйте конфигурацию и перезапустите Nginx:
```bash
ln -s /etc/nginx/sites-available/kheruvimov.ru /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```
Ваш шлюз полностью готов к работе и автодеплою!
