import EventEmitter from './event-emitter';

const kBase = Symbol('base');

export default class Floor extends EventEmitter {
  constructor(base) {
    super();

    this[kBase] = base;

    base.on('up_button_pressed', _ => {
      this.fire('request-elevator', 'up');
    });

    base.on('down_button_pressed', _ => {
      this.fire('request-elevator', 'down');
    });
  }

  get number() {
    return this[kBase].floorNum();
  }

  getDistance(otherFloor) {
    return Math.abs(this.number - otherFloor.number);
  }

  getDirectionTo(otherFloor) {
    return this.liesBelow(otherFloor) ? 'up' : 'down';
  }

  liesBelow(otherFloor) {
    return this.number < otherFloor.number;
  }

  liesAbove(otherFloor) {
    return otherFloor.liesBelow(this);
  }

  liesBetween(floorA, floorB) {
    if (floorA.liesBelow(floorB)) {
      return floorA.liesBelow(this) && this.liesBelow(floorB);
    } else {
      return floorA.liesAbove(this) && this.liesAbove(floorB);
    }
  }

  toString() {
    return `floor ${this.number}`;
  }

  valueOf() {
    return this.number;
  }
}
