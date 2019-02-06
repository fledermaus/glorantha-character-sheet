#!/usr/bin/make

.PHONY: publish

PUBLISH_TO := platypus.pepperfish.net:public_html/glorantha/
EXCLUDE := .git\* Makefile mapping \*~ import-test.html *.xml table-border.html
EXFLAGS := $(foreach x,$(EXCLUDE),--exclude $(x))

all:
	@echo Available targets:
	@echo "   " publish - upload to live site

debug-publish: NOOP := -n
debug-publish: publish

publish:
	@rsync $(EXFLAGS) $(NOOP) --delete -ravL ./ $(PUBLISH_TO)
