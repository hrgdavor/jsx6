

- single ResizeObserver
- find root html element for each block
- put ref to root on each element observed for resize
- put list of connectors to root
- refresh location of connectors after resize
- batch the refresh in case multiple resize in shot time
- use offetTop offsetLeft to get location ... and parent until root
- two phase calc: 
   - 1: getOffsetLeft and offsetTop (maybe not needed as separate step), 
   - 2: calc distance to root
