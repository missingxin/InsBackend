# 使用官方的 Python 執行環境作為基本的 Docker 影像
FROM node:9.11.1-alpine

# 設定工作目錄為 /app
WORKDIR /usr/src/app


# 複製目前目錄下的內容，放進 Docker 容器中的 /app
COPY package.json /usr/src/app
COPY yarn.lock /usr/src/app



# 安裝 requirements.txt 中所列的必要套件
RUN yarn install


COPY . /usr/src/app


# 讓 3000 1883 連接埠可以從 Docker 容器外部存取
EXPOSE 3000

# 定義環境變數
# ENV NAME World

# 當 Docker 容器啟動時，自動執行 app.py
CMD ["npm", "start"]