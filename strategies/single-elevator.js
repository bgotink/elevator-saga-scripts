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
    log.info `Got 'schedule' event from elevator: ${floor} (${direction})`;
    const idx = findRequestIdx(nonScheduledRequests, floor, direction);

    if (idx !== -1) {
      log.info `Unscheduling request for ${floor} (${direction}) because elevator will pass it by itself`;
      nonScheduledRequests.splice(idx, 1);
    }
  });

  elevator.on('unschedule', floors => {
    const { direction } = elevator;
    floors.forEach(floor => scheduleRequest(floor, elevator));
  })

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

    if (!elevator.isFull() && elevator.willPassBy(floor, direction)) {
      elevator.schedule(floor);
      return;
    }

    nonScheduledRequests.push({ floor, direction });
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

    log.info `Currently at ${currentFloor}, requests are: ${nonScheduledRequests.map(({floor, direction}) => `${floor} (${direction})`).join(', ')}`

    // Heuristic: take the oldest direction requested within a reasonable distance
    const direction = (nonScheduledRequests.find(request => request.floor.getDistance(currentFloor) < 3) || nonScheduledRequests[0]).direction;
    log.info `Going for a ride ${direction}`;

    const requestsToWrite = [];
    const freeSpace = elevator.getFreeSpace();

    // Reverse loop because we're splicing
    for (let i = nonScheduledRequests.length - 1; i >= 0; i--) {
      const current = nonScheduledRequests[i];
      if (current.direction === direction) {
        nonScheduledRequests.splice(i, 1);
        requestsToWrite.push(current);

        if (requestsToWrite.length >= freeSpace) {
          break;
        }
      }
    }

    log.info `Writing ${requestsToWrite.length} requests to the elevator`;

    requestsToWrite.sort((a, b) => {
      return a.floor.getDirectionTo(b.floor) === direction ? -1 : 1;
    });

    elevator.start(requestsToWrite.map(({ floor }) => floor), direction);
  }
});
