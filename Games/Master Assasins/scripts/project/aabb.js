export const aabb = (instance1, instance2) => {
    const t1x = instance1[0] + instance1[2]
    const t2x = instance2[0] + instance2[2]
    const t1y = instance1[1] + instance1[3]
    const t2y = instance2[1] + instance2[3]
    if (t1x >= instance2[0] && instance1[0] <= t2x && t1y >= instance2[1] && instance1[1] <= t2y) {
        return {
            x1: Math.max(instance1[0], instance2[0]),
            y1: Math.max(instance1[1], instance2[1]),
            x2: Math.min(t1x, t2x),
            y2: Math.min(t1y, t2y)
        }
    }
    return false
}