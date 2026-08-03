package auth

// import (
//     "context"
//     "golang.org/x/oauth2"
//     "golang.org/x/oauth2/google"
//     "google.golang.org/api/urlshortener/v1"
// )

// 	    var config = &oauth2.Config{
//         ClientID:     "197385228934-7h5af8q29v254sncgc5ptru39la944at.apps.googleusercontent.com", // from https://console.developers.google.com/project/<your-project-id>/apiui/credential
//         ClientSecret: "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", // from https://console.developers.google.com/project/<your-project-id>/apiui/credential
//         Endpoint:     "https://accounts.google.com/o/oauth2/auth",
//         Scopes:       []string{urlshortener.UrlshortenerScope},
//     }

// 	    svc, err := urlshortener.New(httpClient)

// 	    ctx := context.WithValue(context.Background(), oauth2.HTTPClient, &http.Client{
//         Transport: &transport.APIKey{Key: developerKey},
//     })
//     oauthConfig := &oauth2.Config{}
//     var token *oauth2.Token = // via cache, or oauthConfig.Exchange
//     httpClient := oauthConfig.Client(ctx, token)
//     svc, err := urlshortener.New(httpClient)

// 	    url, err := svc.Url.Get(shortURL).Do()
//     if err != nil {

//     }
//     fmt.Printf("The URL %s goes to %s\n", shortURL, url.LongUrl)

// 	    url, err := svc.Url.Get(shortURL).Do()
//     if err != nil {
//         if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusNotFound {
//             ...
//         }
//     }
