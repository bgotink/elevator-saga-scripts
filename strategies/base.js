import Floor from '../floor';
import Elevator from '../elevator';

export default function createStrategy(initFn, updateFn) {
  let elevators;
  let floors;

  return {
    init(els, fls) {
      floors = fls.map(fl => new Floor(fl));
      elevators = els.map((el) => new Elevator(el, floors));

      if (initFn) {
        return initFn(elevators, floors);
      }
    },
    update(dt, els, fls) {
      if (fls.length !== floors.length) {
        throw new Error(`Number of floors changed from ${floors.length} to ${fls.length}`);
      }

      if (els.length !== elevators.length) {
        throw new Error(`Number of elevators changed from ${elevators.length} to ${els.length}`);
      }

      if (updateFn) {
        return updateFn(dt, elevators, floors);
      }
    },
  };
}
