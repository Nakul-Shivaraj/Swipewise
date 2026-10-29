import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable caching-free testing
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

def main():
    port = PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass

    server_address = ('', port)
    
    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(server_address, Handler) as httpd:
        url = f"http://localhost:{port}"
        print(f"✨ SwipeWise Sign Up Preview Server running at: {url}")
        print("Press Ctrl+C to stop the server.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == '__main__':
    main()
