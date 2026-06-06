import { animate, query, style, transition, trigger } from '@angular/animations';

/**
 * Screen transition: the entering view fades + slides up slightly (Material-style
 * "emphasized" entrance). Leave is instant to avoid overlap/positioning jank.
 * Bound to the router-outlet in app.ts; keyed by each route's `data.animation`.
 */
export const routeTransition = trigger('routeTransition', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('260ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'none' })),
      ],
      { optional: true },
    ),
  ]),
]);
