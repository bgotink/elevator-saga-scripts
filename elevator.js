import EventEmitter from './event-emitter';

const kBase = Symbol('base');
const kRequestedFloors = Symbol('requestedFloors');
const kQueue = Symbol('queue');
const kFloors = Symbol('floors');
const kCurrentTarget = Symbol('currentTarget');

function getRequestedFloors(elevator, priority) {
  return elevator[kRequestedFloors][priority ? 'priority' : 'normal'];
}

function getNextTargetFloor(elevator) {
  if (elevator[kQueue].length) {
    return null;
  }

  return elevator[kQueue][0].floor;
}

function sortByDistanceAndDirection(floors, targetFloor, targetDirection) {
  floors.sort((a, b) => {
    let result = 0;

    let dirA = targetFloor.getDirectionTo(a.floor);
    let dirB = targetFloor.getDirectionTo(b.floor);

    if (dirA === targetDirection && dirB === targetDirection) {
      return targetFloor.getDistance(a.floor) - targetFloor.getDistance(b.floor);;
    } else if (dirA === targetDirection) {
      return -1;
    } else {
      return 1;
    }
  });
}

function findClosestRequest(floor, otherFloors) {
  return otherFloors.reduce((previous, current) => {
    if (previous.floor.getDistance(floor) < current.floor.getDistance(floor)) {
      return previous;
    } else {
      return current;
    }
  });
}

export default class Elevator extends EventEmitter {
  constructor(base, floors) {
    super();

    this[kBase] = base;
    this[kRequestedFloors] = { normal: [], priority: [] };
    this[kQueue] = [];

    this[kFloors] = floors;
    this[kCurrentTarget] = null;

    base.on('idle', _ => {
      this.continue();
    });

    // Schedule an important floor when a passenger selects a floor
    // But don't care about the direction
    base.on('floor_button_pressed', floor => {
      this.schedulePriority(floors[floor]);
    });
  }

  get currentFloor() {
    return this[kFloors][this[kBase].currentFloor()];
  }

  continue() {
    if (!this[kQueue].length) {
      this[kCurrentTarget] = null;
      this[kBase].stop();
      this.setDirectionIndicators(null);
      this.fire('idle');
      return;
    }

    this[kCurrentTarget] = this[kQueue].shift();

    this.setDirectionIndicators(this[kCurrentTarget].direction);

    this[kBase].stop();
    this[kBase].goToFloor(this[kCurrentTarget].floor);
  }

  setDirectionIndicators(direction) {
    this[kBase].goingUpIndicator(direction !== 'down');
    this[kBase].goingDownIndicator(direction !== 'up');
  }

  schedule(floor, direction) {
    if (this[kCurrentTarget] && !this[kCurrentTarget].priority) {
      if (this[kCurrentTarget].floor === floor && this[kCurrentTarget].direction === direction) {
        return;
      }
    }

    const requestedFloors = getRequestedFloors(this, false);

    if (requestedFloors.some(rf => rf.floor === floor && rf.direction === direction)) {
      return;
    }

    requestedFloors.push({ floor, direction, priority: false });
    this.recalculateSchedule();
  }

  schedulePriority(floor) {
    if (this[kCurrentTarget] && this[kCurrentTarget].priority) {
      if (this[kCurrentTarget].floor === floor) {
        return;
      }
    }

    const requestedFloors = getRequestedFloors(this, true);

    if (requestedFloors.some(rf => rf.floor === floor)) {
      return;
    }

    requestedFloors.push({ floor, priority: true });
    this.recalculateSchedule();
  }

  recalculateSchedule() {
    const { currentFloor } = this;
    const queue = [{ floor: currentFloor }];
    const priorityRequests = getRequestedFloors(this, true).slice(0);

    if (this[kCurrentTarget] && this[kCurrentTarget].priority) {
      // We're currently en route to a target, which will ofc still be a target
      priorityRequests.push(this[kCurrentTarget]);
    }

    // Sort the current targets by distance to the current floor,
    // then add to the queue
    if (priorityRequests.length) {
      let closestRequest = findClosestRequest(currentFloor, priorityRequests);
      let startDirection = currentFloor.getDirectionTo(closestRequest.floor);

      sortByDistanceAndDirection(priorityRequests, currentFloor, startDirection);

      queue.push(...priorityRequests);

      queue.reduce((previous, current) => {
        previous.direction = previous.floor.getDirectionTo(current.floor);

        return current;
      });

      queue[queue.length - 1].direction = null;
    }

    const normalRequests = getRequestedFloors(this, false).slice(0);

    if (this[kCurrentTarget] && !this[kCurrentTarget].priority) {
      normalRequests.push(this[kCurrentTarget]);
    }

    if (normalRequests.length) {
      if (queue.length) {
        sortByDistanceAndDirection(normalRequests, currentFloor, currentFloor.getDirectionTo(queue[0].floor));

        for (let i = 0, j = 0; i < normalRequests.length; i++) {
          const currentRequest = normalRequests[i];

          if (j >= queue.length) {
            const restOfRequests = normalRequests.slice(i);
            const lastInQueue = queue[queue.length - 1];
            let direction;

            if (queue.length > 2) {
              // continue in the current direction if we have a direction
              direction = queue[queue.length - 2].getDirectionTo(lastInQueue);
            } else {
              // or find the closest target and go there
              direction = lastInQueue.getDirectionTo(findClosestRequest(lastInQueue, normalRequests));
            }

            sortByDistanceAndDirection(restOfRequests, lastInQueue, direction);

            break;
          }
        }
      }
    }

    // Remove the first element in the queue, that's the current floor
    queue.shift();

    this.fire('rescheduled');
    this.continue();
  }
}
