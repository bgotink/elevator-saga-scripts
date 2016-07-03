import createStrategy from './base';
import * as log from '../log';

function findRequestIdx(requests, floor, direction) {
  return requests.findIndex(r => r.floor === floor && r.direction === direction);
}

export default createStrategy(function init(elevators, floors) {
  if (elevators.length !== 1) {
    throw new Error(`Single elevator strategy is not meant to be used for ${elevators.length} elevators`);
  }

  const elevator = elevators[0];
  const nonScheduledRequests = [];

  elevator.on('idle', startElevator);

  elevator.on('schedule', floor => {
    const { direction } = elevator;
    const idx = findRequestIdx(nonScheduledRequests, floor, direction);

    if (idx !== -1) {
      nonScheduledRequests.splice(idx, 1);
    }
  });

  floors.forEach(floor => {
    floor.on('request-elevator', direction => {
      scheduleRequest(floor, direction);
    });
  });

  function scheduleRequest(floor, direction) {
    if (findRequestIdx(nonScheduledRequests, floor, direction) !== -1) {
      // already requested
      return;
    }

    if (elevator.isIdle() || direction !== elevator.direction) {
      nonScheduledRequests.push({ floor, direction });
      startElevator();
      return;
    }

    if (direction === 'up') {
      if (floor < elevator.floor) {
        // Elevator is going up but it's already above the requested floor
        nonScheduledRequests.push({ floor, direction });
        return;
      }

      elevator.schedule(floor);
    } else /*if (direction === 'down')*/ {
      if (floor > elevator.floor) {
        // Elevator is going down but it's already below the requested floor
        nonScheduledRequests.push({ floor, direction });
        return;
      }

      elevator.schedule(floor);
    }
  }

  function startElevator() {
    log.info `Calling startElevator()`;

    if (!elevator.isIdle()) {
      log.info `Skipping startElevator() because elevator is busy`;
      return;
    }
    if (nonScheduledRequests.length === 0) {
      log.info `Skipping startElevator() because there are no requests`;
      return;
    }

    const { floor: currentFloor } = elevator;

    // Heuristic: check for which direction we can pick up the most people
    // const requestsInDirection = {
    //   up: 0,
    //   down: 0,
    // };
    // nonScheduledRequests.forEach(({ direction }) => {
    //   requestsInDirection[direction]++;
    // });
    //
    // log.info `Found ${requestsInDirection.up} requests to go up and ${requestsInDirection.down} to go down`;
    //
    // const direction = requestsInDirection.up > requestsInDirection.down ? 'up' : 'down';

    // Heuristic: take the oldest direction requested
    const direction = nonScheduledRequests[0].direction;

    const requestsToWrite = [];

    // Reverse loop because we're splicing
    for (let i = nonScheduledRequests.length - 1; i >= 0; i--) {
      const current = nonScheduledRequests[i];
      if (current.direction === direction) {
        nonScheduledRequests.splice(i, 1);
        requestsToWrite.push(current);
      }
    }

    log.info `Writing ${requestsToWrite.length} requests to the elevator`;

    requestsToWrite.sort((a, b) => {
      return a.floor.getDirectionTo(b.floor) === direction ? -1 : 1;
    });

    elevator.start(requestsToWrite.map(({ floor }) => floor), direction);
  }
});
