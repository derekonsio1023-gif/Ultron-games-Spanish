const destroy = (instance) => instance.destroy()

const destroyPathLines = (runtime) => {
    runtime.objects.waypoint.getAllInstances().forEach(destroy)
    runtime.objects.wayline.getAllInstances().forEach(destroy)
    runtime.objects.wayend.getAllInstances().forEach(destroy)
}

const createPathLines = (runtime, player) => {
    destroyPathLines(runtime)

    for (let i = 0; i < player.pathfindingNodes.length; i++) {
        const nodes = player.pathfindingNodes
        let x1, y1, x2, y2

        runtime.objects.waypoint.createInstance("level_waypoints", nodes[nodes.length - i - 1][0], nodes[nodes.length - i - 1][1])

        if (i == 0) {
            x1 = player.x
            y1 = player.y
            x2 = nodes[nodes.length - 1][0]
            y2 = nodes[nodes.length - 1][1]
        }
        else if (i < nodes.length - 1) {
            x1 = nodes[i][0]
            y1 = nodes[i][1]
            x2 = nodes[i + 1][0]
            y2 = nodes[i + 1][1]
        }
        else {
            x1 = nodes[1][0]
            y1 = nodes[1][1]
            x2 = nodes[0][0]
            y2 = nodes[0][1]
        }

        const wayline = runtime.objects.wayline.createInstance("level_waypoints", x1, y1)
        wayline.width = C3.distanceTo(wayline.x, wayline.y, x2, y2)
        wayline.angle = C3.angleTo(wayline.x, wayline.y, x2, y2)

        if (i == nodes.length - 1) {
            const wayend = runtime.objects.wayend.createInstance("level_waypoints", x2, y2)
            wayend.angle = wayline.angle
        }
    }

}

export { destroyPathLines, createPathLines }