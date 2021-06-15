# A script to generate Jekyll _site and push it to the gh-pages branch

version=($(git rev-parse --short HEAD))

PACKAGE_VERSION=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

# Remove the current content of the _site folder
rm -rf _site

# Get the latest commit in main branch
commit=$(git log -n 1 --pretty='format:%C(auto)%h (%s, %ad)')
echo "[Commit]: ${commit}"

# Clone remote _site branch 
git clone -b gh-pages `git config remote.origin.url` _site

# Build Production _site
JEKYLL_ENV=production bundle exec jekyll build

# Switch directory to _site
cd _site

# Define the commit message
message="Deploying commit $commit to gh-pages"
echo "[Warning]: ${message}."

# Add new or changed files in _site working directory to the Git staging area.
git add .

# Commit the changes to the to gh-pages branch
git commit -m "$message" > /dev/null 2>&1

# Push the changes to the to gh-pages branch
git push > /dev/null 2>&1
if [ $? = 0 ]; then
  echo "[Success]: Deployment successful of v$PACKAGE_VERSION ($version) to gh-pages"
else
  echo "[Error]: Deployment failure of v$PACKAGE_VERSION ($version) to gh-pages"
fi
