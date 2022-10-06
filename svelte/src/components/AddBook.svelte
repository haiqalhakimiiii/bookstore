<script>
   let book = {
      title: '',
      author: '',
      pages: '',
      genres: [],
      rating: ''
   }
   
   let result = ''

   async function doPost() {
      const res = await fetch('http://localhost:3000/books',{
         method: 'POST',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify(book)
      })
      const response = await res.json()
      result = JSON.stringify(response)

      book = {
      title: '',
      author: '',
      pages: '',
      genres: [],
      rating: ''
   }
   }
</script>

<div class="form">
   <form>
      <input type="text" bind:value={book.title} placeholder="Title">
      <input type="text" bind:value={book.author} placeholder="Author">
      <input type="number" bind:value={book.pages} placeholder="Number of pages">
      <label>
         Genres: <br>
         <input type="checkbox" bind:group={book.genres} value="Action">Action<br>
         <input type="checkbox" bind:group={book.genres} value="Crime">Crime<br>
         <input type="checkbox" bind:group={book.genres} value="Drama">Drama<br>
         <input type="checkbox" bind:group={book.genres} value="Horror">Horror<br>
         <input type="checkbox" bind:group={book.genres} value="Thriller">Thriller<br>
      </label>
      <input type="number" bind:value={book.rating} placeholder="Rating">
      <button type="button" on:click|preventDefault={doPost}>Add Book</button>
   </form>
</div>

