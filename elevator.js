import EventEmitter from './event-emitter';
import Floor from './floor';
import * as log from './log';

const kBase = Symbol('base');
const kQueue = Symbol('queue');
const kFloors = Symbol('floors');
const kDirection = Symbol('direction');
const kCurrentTarget = Symbol('currentTarget');

export default class Elevator extends EventEmitter {
  constructor(id, base, floors) {
    super();

    this.id = id;

    this[kBase] = base;
    this[kFloors] = floors;

    this[kQueue] = [];
    this.direction = null;

    base.on('idle', _ => {
      log.info `Elevator ${id} idle`;
      this.continue();
    });

    // Schedule an important floor when a passenger selects a floor
    // But don't care about the direction
    base.on('floor_button_pressed', floor => {
      log.info `Button for floor ${floor} pressed in elevator ${id}`;
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

  willPassBy(floor, direction) {
    if (direction !== this.direction) {
      return false;
    }

    if (this.direction === 'up') {
      return floor > this.floor;
    } else /*if (this.direction === 'down')*/ {
      return floor < this.floor;
    }
  }

  schedule(requestedFloor) {
    const { direction, floor } = this;

    if (requestedFloor === floor && !(this.isIdle() || this[kQueue].length === 0)) {
      log.info `schedule ${this.id}: Scheduling ${requestedFloor} but we're already there (and moving ${direction})`;
      return; // we're already on the requested floor
    }

    const requestedDirection = floor.getDirectionTo(requestedFloor);

    if (this.isIdle()) {
      log.info `schedule ${this.id}: Elevator idle`
      this[kQueue].push(requestedFloor);
      this.direction = requestedDirection;
      this.continue();
      this.fire('schedule', requestedFloor, requestedDirection);
      return;
    }

    if (direction !== requestedDirection) {
      if (requestedFloor !== floor) {
        throw new Error(`Requested ${requestedFloor} in direction ${requestedDirection} (currently at ${floor}), but elevator ${this.id} currently going in direction ${direction}`);
      }

      this.goTo(floor);
      return;
    }

    if (direction === 'up') {
      if (requestedFloor < this[kCurrentTarget]) {
        // We pass the new request first, and only then we pass our current target
        // -> make the requested floor the first target
        log.info `schedule ${this.id}: Inserting new floor before current queue`;
        this[kQueue].unshift(requestedFloor, this[kCurrentTarget]);
        this.continue();
        this.fire('schedule', requestedFloor);
        return;
      }

      for (let i = 0; i < this[kQueue].length; i++) {
        if (requestedFloor < this[kQueue][i]) {
          // We pass the requested floor before queued floor _i_
          // -> insert the requested floor here
          log.info `schedule ${this.id}: Inserting new floor at index ${i} in the queue`;
          this[kQueue].splice(i, 0, requestedFloor);
          // No need to call continue() here
          this.fire('schedule', requestedFloor);
          return;
        }
      }

      // We haven't inserted the floor anywhere -> add it to the end of the queue
      log.info `schedule ${this.id}: Pushing new floor to end of the queue`;
      this[kQueue].push(requestedFloor);
    } else /*if (direction === 'down')*/ {
      if (requestedFloor > this[kCurrentTarget]) {
        // We pass the new request first, and only then we pass our current target
        // -> make the requested floor the first target
        log.info `schedule ${this.id}: Inserting new floor before current queue`;
        this[kQueue].unshift(requestedFloor, this[kCurrentTarget]);
        this.continue();
        this.fire('schedule', requestedFloor);
        return;
      }

      for (let i = 0; i < this[kQueue].length; i++) {
        if (requestedFloor > this[kQueue][i]) {
          // We pass the requested floor before queued floor _i_
          // -> insert the requested floor here
          log.info `schedule ${this.id}: Inserting new floor at index ${i} in the queue`;
          this[kQueue].splice(i, 0, requestedFloor);
          // No need to call continue() here
          this.fire('schedule', requestedFloor);
          return;
        }
      }

      // We haven't inserted the floor anywhere -> add it to the end of the queue
      log.info `schedule ${this.id}: Pushing new floor to end of the queue`;
      this[kQueue].push(requestedFloor);
      this.fire('schedule', requestedFloor);
    }
  }

  continue() {
    log.info `continue ${this.id}: called`

    if (this.isFull()) {
      log.info `continue ${this.id}: elevator is full, removing all superfluous requests`
      const pressedFloors = this[kBase].getPressedFloors().map(floor => this[kFloors][floor]);
      const superfluous = [];

      for (let i = this[kQueue].length - 1; i >= 0; i--) {
        if (!pressedFloors.includes(this[kQueue][i])) {
          superfluous.push(this[kQueue][i]);
          this[kQueue].splice(i, 1);
        }
      }

      if (superfluous.length) {
        log.info `continue ${this.id}: Unscheduling ${superfluous.length} requests`;
        this.fire('unschedule', superfluous);
      }
    }

    if (!this[kQueue].length) {
      log.info `continue ${this.id}: nothing in the queue, stopping elevator & firing 'idle' event`
      this[kBase].stop();
      this.direction = null;
      this.fire('idle');
      return;
    }

    this[kCurrentTarget] = this[kQueue].shift();
    log.info `continue ${this.id}: going to ${this[kCurrentTarget]}`;

    this[kBase].stop();
    this.goTo(this[kCurrentTarget]);
  }

  start(floors, direction) {
    log.info `start ${this.id}: going ${direction}: ${floors.join(' -> ')}`;
    this.direction = direction;
    this[kQueue] = floors;

    this.continue();
  }

  goTo(floor) {
    if (!(floor instanceof Floor)) {
      floor = this[kFloors][floor];
    }

    log.info `goTo ${this.id}: going to ${floor}`;

    if (floor === this.floor) {
      log.info `goTo ${this.id}: already at ${floor}`;
    }

    this[kBase].goToFloor(floor.number);
  }

  isFull() {
    return this[kBase].loadFactor() >= 0.8;
  }
}
