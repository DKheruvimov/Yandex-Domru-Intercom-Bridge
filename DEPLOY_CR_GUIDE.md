# Инструкция по развертыванию Шлюза Дом.ру — Яндекс на VPS

У вас есть два основных (и очень удобных) способа настроить CI/CD через GitHub Actions для этого проекта:

---

## Способ 1. Через Cloud.ru Artifact Registry (Рекомендуемый, безопасный)

Так как вы уже пользовались Artifact Registry (Container Registry) на Cloud.ru, этот способ идеален: сборка Docker-образа происходит прямо в GitHub Actions, образ сохраняется в приватный реестр Cloud.ru, а на самом сервере VPS происходит только скачивание (`pull`) и перезапуск контейнера. Это позволяет не хранить приватные SSH-ключи в репозитории (или разграничить доступы).

### 1. Подготовка секретов в GitHub
Вам необходимо добавить следующие секреты в ваш GitHub-репозиторий (**Settings ➔ Secrets and variables ➔ Actions ➔ New repository secret**):
- `CR_REGISTRY`: Адрес вашего реестра в Cloud.ru (например, `cr.ru-central1.aerid.co` или аналогичный).
- `CR_USERNAME`: Имя пользователя или сервисного аккаунта для авторизации в реестре.
- `CR_PASSWORD`: Пароль или ключ доступа.
- `VPS_HOST`: IP-адрес вашей VPS.
- `VPS_USERNAME`: Имя пользователя SSH (обычно `root` или `ubuntu`).
- `VPS_SSH_KEY`: Ваш приватный SSH-ключ для запуска команды обновления на сервере.

### 2. Файл GitHub Actions (`.github/workflows/deploy-registry.yml`)
Вы можете переименовать или заменить текущий файл на подобную конфигурацию:

```yaml
name: Build and Push Docker image to Cloud.ru CR & Deploy

on:
  push:
    branches:
      - main

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install & Build Frontend-Backend
        run: |
          if [ -f package-lock.json ]; then
            npm ci
          else
            npm install
          fi
          npm run build

      - name: Set up Docker Buildx
        uses: docker/setup-qemu-action@v3
        
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Cloud.ru Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ secrets.CR_REGISTRY }}
          username: ${{ secrets.CR_USERNAME }}
          password: ${{ secrets.CR_PASSWORD }}

      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ secrets.CR_REGISTRY }}/domru-bridge:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Execute remote deployment commands via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_KEY }}
          passphrase: ${{ secrets.VPS_PASSPHRASE }} # Опционально
          script: |
            # 1. Логинимся в реестр на стороне VPS
            echo "${{ secrets.CR_PASSWORD }}" | docker login ${{ secrets.CR_REGISTRY }} -u "${{ secrets.CR_USERNAME }}" --password-stdin
            
            # 2. Скачиваем новый образ
            docker pull ${{ secrets.CR_REGISTRY }}/domru-bridge:latest
            
            # 3. Останавливаем старый контейнер
            docker stop domru-bridge || true
            docker rm domru-bridge || true
            
            # 4. Запускаем новый контейнер на свободном порту 3100
            docker run -d \
              --name domru-bridge \
              --restart always \
              -p 3100:3000 \
              ${{ secrets.CR_REGISTRY }}/domru-bridge:latest
              
            # 5. Очищаем старые неиспользуемые слои
            docker image prune -f
            
            echo "Обновление шлюза на порту 3100 завершено успешно!"
```

---

## Способ 2. Прямой деплой через SSH (то, что настроено сейчас)

Если вы хотите использовать текущий файл `.github/workflows/deploy.yml` (где файлы компилируются, переносятся через SCP, а Docker-образ строится прямо на самой VPS):

1. Перейдите в настройки вашего GitHub репозитория:
   **Settings ➔ Secrets and variables ➔ Actions**
2. Нажмите кнопку **New repository secret** и добавьте следующие ключи:
   - `VPS_HOST` — внешний IP-адрес вашей виртуальной машины на Cloud.ru.
   - `VPS_USERNAME` — имя пользователя SSH (например, `root`, `ubuntu` или `centos`).
   - `VPS_SSH_KEY` — содержимое вашего приватного SSH-ключа (файл `id_rsa` / `id_ed25519` со стороны вашего локального ПК или сервера, у которого есть доступ к VPS).
   - `VPS_PASSPHRASE` — *(опционально)* если ваш приватный SSH-ключ зашифрован паролем.

После добавления этих секретов любой новый push в ветку `main` успешно выполнит деплой в Docker на порт `3100`.

---

## Как это уживается со старым проектом (kheruvimovy.ru)
Так как первый проект работает на своих портах и доменах:
1. Контейнер нового шлюза запускается на порту `3100` (никак не пересекаясь с портами первого проекта).
2. На сервере в конфигурационном файле Nginx (например, в `/etc/nginx/sites-available/` или в общей папке конфигураций) вам достаточно настроить проксирование с нового домена `kheruvimov.ru` (или `kheruvimovy.online`) на локальный порт `3100`.

Пример секции в Nginx для нового домена:
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
Такой подход гарантирует, что оба ваших проекта будут работать на одной и той же VPS абсолютно независимо и плавно!
