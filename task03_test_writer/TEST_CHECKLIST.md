# Test Checklist — `applyDiscount(price, customerType, couponCode)`

| # | Category | Case | Input | Expected |
|---|----------|------|-------|----------|
| 1 | Normal | No discount | (100) | 100.0 |
| 2 | Normal | VIP | (100,'vip') | 85.0 |
| 3 | Normal | Regular | (100,'regular') | 95.0 |
| 4 | Normal | Unknown customer type | (100,'guest') | 100.0 |
| 5 | Normal | SAVE10 coupon | (100,None,'SAVE10') | 90.0 |
| 6 | Normal | SAVE20 coupon | (100,None,'SAVE20') | 80.0 |
| 7 | Combo | VIP + SAVE10 (max → VIP) | (100,'vip','SAVE10') | 85.0 |
| 8 | Combo | VIP + SAVE20 (max → coupon) | (100,'vip','SAVE20') | 80.0 |
| 9 | Combo | Regular + SAVE10 (coupon wins) | (100,'regular','SAVE10') | 90.0 |
| 10 | Combo | Regular + SAVE20 (coupon wins) | (100,'regular','SAVE20') | 80.0 |
| 11 | Edge | Zero price | (0,'vip','SAVE20') | 0.0 |
| 12 | Edge | Rounding to 2 dp | (99.99,'vip') | 84.99 |
| 13 | Edge | Invalid coupon ignored | (100,'regular','BOGUS') | 95.0 |
| 14 | Error | Negative price | (-1) | raises ValueError |
| 15 | Error | Negative price + coupon | (-50,'vip','SAVE20') | raises ValueError |
