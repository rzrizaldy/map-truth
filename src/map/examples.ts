/**
 * Starter briefs, chosen to make the failure mode obvious in one click.
 *
 * Each names a real place and asks for something a model cannot fake without
 * being caught: specific buildings, named trails, actual landmarks.
 */
export type Example = { prompt: string; label: string; note: string }

export const EXAMPLES: Example[] = [
  {
    label: 'Peta demo DPR Jakarta',
    prompt: 'Peta demo DPR Jakarta. Tandai titik kumpul dan pos medis.',
    note: 'Gathering points and medical posts around the parliament',
  },
  {
    label: 'New York iconic landmarks',
    prompt: 'New York iconic landmarks poster. Mark the famous sights and nearest transit.',
    note: 'Landmarks and stations, where they really are',
  },
  {
    label: 'Pittsburgh bike trail',
    prompt: 'Pittsburgh bike trail map. Show parks and places to refill water along the way.',
    note: 'Trail-side parks and water, from OpenStreetMap',
  },
]
