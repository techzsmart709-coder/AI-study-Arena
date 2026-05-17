rmdir /s /q .git

git init
git branch -M main
git add .
git commit -m "clean upload"

git remote add origin https://github.com/techzsmart709-coder/AI-study-Arena.git

git push -u origin main --force
