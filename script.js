// Keep one guide step expanded at a time; native details remain usable without JS.
const steps = [...document.querySelectorAll('.step')];
for (const step of steps) {
  step.addEventListener('toggle', () => {
    if (step.open) for (const other of steps) if (other !== step) other.open = false;
  });
}
