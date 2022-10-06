<script>
   import { onMount } from "svelte";
   
   let jsonplaceholder = []

   onMount(async () => {
      const response = await fetch('https://jsonplaceholder.typicode.com/users')
      jsonplaceholder = await response.json()
   })
</script>

<div>
   {#each jsonplaceholder as json (json.id) }
      <p>{json.name}</p>
   {/each}
</div>