#!/bin/sh
# This should be called from the project root directory, i.e.:
# $ docs/gh-publish.sh
set -x
BUILDDIR=.gh-pages-build
BUILD_BRANCH=gh-pages
test -f docs/index.xhtml || exit 1
(
set -e
git worktree add --detach $BUILDDIR master
pushd $BUILDDIR
pushd docs
cp ../index.js uri-template-router.bundle.js
popd
git add -f docs/
BUILD_ID=$(git commit-tree -p master -m 'gh-pages build' $(git write-tree))
popd
git push -f gh-publish $BUILD_ID:$BUILD_BRANCH
)
git worktree remove -f $BUILDDIR
