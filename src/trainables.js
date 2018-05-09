import ruleset from 'fathom-web';
import Run from 'fathom-web/optimizers';

/**
 * A map of names to :class:`Run` subclasses, all of which become available to
 * train via the UI
 */
const trainables = new Map();


// NEXT: We just need to replace the Corpus and Sample classes, and we should be golden to run in-browser. (The tuner will instantiate those and pass them in.) baseFolder() can be repurposed to be a more generic sample ID.
trainables.set(
    'overlay',
    class ComicRun extends Run {
        rulesetMaker(coeffSize = 1) {
            function heightAndWidth(element) {
                const rect = boundingRect(element);
                const height = rect.bottom - rect.top;
                const width = rect.right - rect.left;
                return [height, width];
            }

            /** Return the number of pixels in an image, as a size metric. */
            function numberOfPixels(element) {
                let [height, width] = heightAndWidth(element);
                return height * width;
            }

            return ruleset(
                // Start with all images:
                rule(dom('img'), type('comic')),
                // Score them by size:
                rule(type('comic'), score(fnode => numberOfPixels(fnode.element) * coeffSize)),
                rule(type('comic').max(), out('comic'))
            );
        }

        initialScoreParts() {
            return {number: 0, numberWrong: 0};
        }

        /**
         * Run the ruleset over the single sample, and update scoreParts.
         *
         * @arg sample An arbitrary data structure that specifies which sample
         *     from the corpus to run against and the expected answer
         */
        updateScoreParts(sample, ruleset, scoreParts) {
            const facts = ruleset.against(sample.doc);
            const winners = facts.get('comic');
            if (winners.length >= 1) {
                const winner = winners[0];
                if (winner.element.getAttribute('data-fathom') !== 'overlay') {
                    scoreParts.numberWrong += 1;
                    console.log('* Wrong answer for ' + sample.name + '.');
                }
            } else {
                scoreParts.numberWrong += 1;
                console.log('* No potential elements at all found for ' + sample.name);
            }
            scoreParts.number += 1;
        }

        score() {
            return this.scoreParts.numberWrong;
        }

        humanScore() {
            return (1 - (this.score() / this.scoreParts.number)) * 100;
        }
    }
);
