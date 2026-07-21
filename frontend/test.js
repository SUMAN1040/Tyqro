function render() {
  let proceedEndWork;
  const intervalFunc = () => {
    proceedEndWork();
  };
  proceedEndWork = () => { console.log("It works!"); };
  intervalFunc();
}
render();
