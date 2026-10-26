'use strict';

/**
 * The size range each category is sold in (the same ranges the seed script
 * uses). Shoes run UK 3 to UK 10, tops and dresses XS to XXL, and trousers
 * and jeans by waist from 28 to 44.
 */
const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SHOE_SIZES = ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'];
const WAIST_SIZES = ['28', '30', '32', '34', '36', '38', '40', '42', '44'];

const SIZE_RANGES = {
  Footwear: SHOE_SIZES,
  Tees: LETTER_SIZES, Shirts: LETTER_SIZES, Polos: LETTER_SIZES, Hoodies: LETTER_SIZES,
  Knitwear: LETTER_SIZES, Jackets: LETTER_SIZES, Outerwear: LETTER_SIZES, Dresses: LETTER_SIZES,
  Trousers: WAIST_SIZES, Jeans: WAIST_SIZES,
  Accessories: ['One Size'],
};

function sizesForCategory(category) {
  return SIZE_RANGES[category] || ['One Size'];
}

module.exports = { SIZE_RANGES, LETTER_SIZES, SHOE_SIZES, WAIST_SIZES, sizesForCategory };
