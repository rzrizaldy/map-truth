/**
 * Starter briefs, chosen to make the failure mode obvious in one click.
 *
 * Each names a real place and asks for something a model cannot fake without
 * being caught: specific buildings, named trails, actual landmarks.
 */
export type Example = { prompt: string; label: string; note: string; place: string }

export const EXAMPLES: Example[] = [
  {
    label: 'Peta demo DPR Jakarta',
    place: 'DPR Jakarta',
    prompt: 'Peta demo. Tandai titik kumpul dan pos medis.',
    note: 'Gathering points and medical posts around the parliament',
  },
  {
    // Deliberately not "iconic": OpenStreetMap records what exists, not what is
    // famous, so a brief that promises the postcard five cannot be kept. It is
    // precise about museums, landmarks and stations, which is what this asks for.
    label: 'New York landmarks & subway',
    place: 'Lower Manhattan, New York',
    prompt: 'Landmarks and subway map. Mark the sights and the nearest stations.',
    note: 'Real landmarks and stations, where they actually are',
  },
  {
    label: 'Pittsburgh bike trail',
    place: 'Pittsburgh',
    prompt: 'Bike trail map. Show parks and places to refill water along the way.',
    note: 'Trail-side parks and water, from OpenStreetMap',
  },
]
