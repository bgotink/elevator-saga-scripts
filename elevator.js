import EventEmitter from './event-emitter';
import Floor from './floor';

const kBase = Symbol('base');
const kQueue = Symbol('queue');
const kFloors = Symbol('floors');
const kDirection = Symbol('direction');
const kCurrentTarget = Symbol('currentTarget');

export default class Elevator extends EventEmitter {
  constructor(base, floors) {
    super();

    this[kBase] = base;
    this[kFloors] = floors;

    this[kQueue] = [];
    this.direction = null;

    base.on('idle', _ => {
      this.continue();
    });

    // Schedule an important floor when a passenger selects a floor
    // But don't care about the direction
    base.on('floor_button_pressed', floor => {
      this.schedule(floors[floor]);
    });
  }

  get floor() {
    return this[kFloors][this[kBase].currentFloor()];
  }

  get direction() {
    return this[kDirection];
  }

  isIdle() {
    return this[kDirection] == null;
  }

  set direction(dir) {
    if (dir === this[kDirection]) {
      return dir;
    }

    this[kBase].goingDownIndicator(dir === 'down');
    this[kBase].goingUpIndicator(dir === 'up');

    return this[kDirection] = dir;
  }

  schedule(requestedFloor) {
    const { direction, floor } = this;

    if (requestedFloor === floor) {
      return; // we're already on the requested floor
    }

    const requestedDirection = floor.getDirectionTo(requestedFloor);

    if (this.isIdle()) {
      this[kQueue].push(requestedFloor);
      this.direction = requestedDirection;
      this.continue();
      this.fire('schedule', requestedFloor, requestedDirection);
      return;
    }

    if (direction !== requestedDirection) {
      throw new Error(`Requested ${requestedFloor} in direction ${requestedDirection} (currently at ${floor}), but currently going in direction ${direction}`);
    }

    this.fire('schedule', requestedFloor);

    if (direction === 'up') {
      if (requestedFloor < this[kCurrentTarget]) {
        // We pass the new request first, and only then we pass our current target
        // -> make the requested floor the first target
        this[kQueue].unshift(requestedFloor, this[kCurrentTarget]);
        this.continue();
        return;
      }

      for (let i = 0; i < this[kQueue].length; i++) {
        if (requestedFloor < this[kQueue][i]) {
          // We pass the requested floor before queued floor _i_
          // -> insert the requested floor here
          this[kQueue].splice(i, 0, requestedFloor);
          // No need to call continue() here
          return;
        }
      }

      // We haven't inserted the floor anywhere -> add it to the end of the queue
      this[kQueue].push(requestedFloor);
    } else /*if (direction === 'down')*/ {
      if (requestedFloor > this[kCurrentTarget]) {
        // We pass the new request first, and only then we pass our current target
        // -> make the requested floor the first target
        this[kQueue].unshift(requestedFloor, this[kCurrentTarget]);
        this.continue();
        return;
      }

      for (let i = 0; i < this[kQueue].length; i++) {
        if (requestedFloor > this[kQueue][i]) {
          // We pass the requested floor before queued floor _i_
          // -> insert the requested floor here
          this[kQueue].splice(i, 0, requestedFloor);
          // No need to call continue() here
          return;
        }
      }

      // We haven't inserted the floor anywhere -> add it to the end of the queue
      this[kQueue].push(requestedFloor);
    }
  }

  continue() {
    if (!this[kQueue].length) {
      this[kBase].stop();
      this.direction = null;
      this.fire('idle');
      return;
    }

    this[kCurrentTarget] = this[kQueue].shift();

    this[kBase].stop();
    this.goTo(this[kCurrentTarget]);
  }

  start(floors, direction) {
    this.direction = direction;
    this[kQueue] = floors;

    this.continue();
  }

  goTo(floor) {
    if (!(floor instanceof Floor)) {
      floor = this[kFloors][floor];
    }

    if (floor === this.floor) {
      return;
    }

    this[kBase].goToFloor(floor.number);
  }
}
