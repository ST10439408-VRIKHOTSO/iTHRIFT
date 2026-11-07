'use strict';

/**
 * Sample reviews and product questions.
 *
 * The module requires at least ten rows in every table, so the seed fills
 * Review and ProductQuestion as well. These rows are made up, so they are
 * stored with IsSample = 1. The product pages label them as samples and leave
 * them out of every star rating, so no shopper is shown invented feedback as
 * if a customer had written it.
 *
 * Not every sample rating is five stars, so the star widget is exercised with
 * the full range.
 */

// Customers are indexes into the seed's customer list.
const SAMPLE_REVIEWS = [
  { product: 'Air Force 1 Low', customer: 0, rating: 5, comment: 'Looked exactly like the photos and arrived really well packaged. Great find!' },
  { product: 'Slim Chino Trousers', customer: 0, rating: 4, comment: 'Lovely fit, slightly more worn than I expected but still great value.' },
  { product: 'Cable Knit Jumper', customer: 1, rating: 5, comment: 'Barely worn, smells fresh, fits true to size. Will shop here again.' },
  { product: 'Samba OG Trainers', customer: 3, rating: 5, comment: 'Gum sole is barely marked. For the price of one new pair I got these and a tee.' },
  { product: 'Flag Logo Tee', customer: 3, rating: 3, comment: 'Graded Good and it is Good, but the print has cracked a little. Fair enough for the price.' },
  { product: 'Tie-Waist Maxi Dress', customer: 4, rating: 4, comment: 'Beautiful fabric. Runs slightly small, size up if you are between sizes.' },
  { product: 'Air Max 90', customer: 5, rating: 5, comment: 'Cleaner in person than in the listing. Delivered to Centurion in two days.' },
  { product: 'Oversized Tee', customer: 5, rating: 4, comment: 'Exactly the oversized fit I wanted. Would have liked more photos of the back.' },
  { product: 'Straight Leg Jeans', customer: 5, rating: 2, comment: 'Hem was frayed in a way the photographs did not show. Support sorted it out but check yours.' },
  { product: 'Zip-Through Hoodie', customer: 7, rating: 5, comment: 'Thick and warm, no bobbling at all. Hard to believe it is second hand.' },
  { product: 'Classic Chino Trousers', customer: 7, rating: 4, comment: 'Good honest condition, pressed and ready to wear.' },
  { product: 'Floral Halter Maxi Dress', customer: 8, rating: 5, comment: 'Wore it to a wedding and got three compliments. Nobody guessed it was pre-loved.' },
  { product: 'Fine Knit Jumper', customer: 8, rating: 3, comment: 'Fine but there is a small pull on the sleeve that was not mentioned.' },
  { product: 'Dunk Low', customer: 9, rating: 5, comment: 'Sizing advice on the listing was spot on. Very happy.' },
  { product: 'Heritage Polo Shirt', customer: 10, rating: 4, comment: 'Collar still stands up properly, which is rare second hand. Good buy.' },
];

// [product, customer index, question, answer or null, answering staff username or null]
const SAMPLE_QUESTIONS = [
  ['Air Force 1 Low', 1, 'Do these run true to size?', 'They run about half a size big, so most people take their usual size or half down.', 'staff01'],
  ['Samba OG Trainers', 3, 'Is the gum sole yellowed at all?', 'Very lightly on the heel only. We added a close-up to the description.', 'staff02'],
  ['Faux-Fur Logo Jacket', 0, 'Does the hood detach?', 'No, the hood is sewn in.', 'staff01'],
  ['Tie-Waist Maxi Dress', 4, 'How long is it from shoulder to hem?', 'About 138 cm measured flat.', 'admin'],
  ['Slim Fit Jeans', 5, 'Is there any stretch in the denim?', 'Yes, it is a cotton blend with about 2 percent elastane.', 'staff03'],
  ['CK96 Crew Sweater', 6, 'Is the print cracked?', 'No cracking at all. It is in excellent condition.', 'staff01'],
  ['Dunk Low', 7, 'Do they come with the original box?', 'No box, but they are cleaned and come in an iTHRIFT dust bag.', 'staff02'],
  ['Silver Cuban Link Bracelet', 8, 'Is this real silver?', null, null],
  ['Quilted Puffer Gilet', 9, 'Is it water resistant?', null, null],
  ['Ultraboost Sneakers', 10, 'Can I try them on in store first?', null, null],
];

const SAMPLE_COLUMN = 'IsSample INTEGER NOT NULL DEFAULT 0 CHECK (IsSample IN (0, 1))';

/**
 * Brings a database from before the sample label up to date: adds IsSample
 * to both tables and marks the rows that came from this file, keeping every
 * real review and question as it was. Returns true when it changed something.
 */
function labelSampleContent(db) {
  let changed = false;
  const tables = [
    ['Review', 'Comment', SAMPLE_REVIEWS.map((r) => r.comment)],
    ['ProductQuestion', 'Question', SAMPLE_QUESTIONS.map((q) => q[2])],
  ];
  for (const [table, column, texts] of tables) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (columns.length === 0 || columns.includes('IsSample')) continue;
    db.exec('BEGIN');
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${SAMPLE_COLUMN}`);
      const mark = db.prepare(`UPDATE ${table} SET IsSample = 1 WHERE ${column} = ?`);
      for (const text of texts) mark.run(text);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    changed = true;
  }
  return changed;
}

module.exports = { SAMPLE_REVIEWS, SAMPLE_QUESTIONS, SAMPLE_COLUMN, labelSampleContent };
