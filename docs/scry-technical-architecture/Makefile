DOC := scry-technical-architecture

.PHONY: all clean

all: $(DOC).pdf

$(DOC).pdf: $(DOC).tex references.bib
	xelatex -interaction=nonstopmode -halt-on-error $(DOC).tex
	bibtex $(DOC)
	xelatex -interaction=nonstopmode -halt-on-error $(DOC).tex
	xelatex -interaction=nonstopmode -halt-on-error $(DOC).tex

clean:
	rm -f $(DOC).aux $(DOC).bbl $(DOC).blg $(DOC).log $(DOC).out $(DOC).toc $(DOC).pdf
